import crypto from 'crypto'
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose'
import { AccessToken, RefreshToken, TokenType } from '../types.js'

/**
 * Token utilities for OAuth 2.1
 */

/**
 * Generate a random token
 * @param length Length of the token
 * @returns A random token
 */
export function generateRandomToken(length: number = 32): string {
  const bytes = crypto.randomBytes(length)
  return bytes.toString('base64url')
}

/**
 * Generate a secure access token
 * @param length Length of the token
 * @returns A secure access token
 */
export function generateAccessToken(length: number = 32): string {
  return generateRandomToken(length)
}

/**
 * Generate a secure refresh token
 * @param length Length of the token
 * @returns A secure refresh token
 */
export function generateRefreshToken(length: number = 64): string {
  return generateRandomToken(length)
}

/**
 * Generate a secure authorization code
 * @param length Length of the code
 * @returns A secure authorization code
 */
export function generateAuthorizationCode(length: number = 32): string {
  return generateRandomToken(length)
}

/**
 * Create a JWT access token
 * @param payload The token payload
 * @param privateKey The private key for signing
 * @param algorithm The signing algorithm
 * @param expiresIn Expiration time in seconds
 * @returns A signed JWT token
 */
export async function createJwtToken(
  payload: Record<string, any>,
  privateKey: string,
  algorithm: string = 'RS256',
  expiresIn: number = 3600
): Promise<string> {
  const key = await importPKCS8(privateKey, algorithm)
  
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
  
  return await jwt.sign(key)
}

/**
 * Verify a JWT token
 * @param token The JWT token to verify
 * @param publicKey The public key for verification
 * @param algorithm The signing algorithm
 * @returns The decoded token payload
 */
export async function verifyJwtToken(
  token: string,
  publicKey: string,
  algorithm: string = 'RS256'
): Promise<Record<string, any>> {
  const key = await importSPKI(publicKey, algorithm)
  
  const { payload } = await jwtVerify(token, key, {
    algorithms: [algorithm]
  })
  
  return payload
}

/**
 * Check if a token is expired
 * @param token The token to check
 * @returns True if the token is expired
 */
export function isTokenExpired(token: AccessToken | RefreshToken): boolean {
  return new Date() > token.expiresAt
}

/**
 * Get token expiration time in seconds from now
 * @param token The token to check
 * @returns Seconds until expiration, negative if expired
 */
export function getTokenExpirationSeconds(token: AccessToken | RefreshToken): number {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = Math.floor(token.expiresAt.getTime() / 1000)
  return expiresAt - now
}

/**
 * Create a token response object
 * @param accessToken The access token
 * @param tokenType The token type
 * @param expiresIn Expiration time in seconds
 * @param refreshToken Optional refresh token
 * @param scope Optional scope
 * @returns A token response object
 */
export function createTokenResponse(
  accessToken: string,
  tokenType: TokenType = 'Bearer',
  expiresIn: number,
  refreshToken?: string,
  scope?: string
) {
  const response: any = {
    access_token: accessToken,
    token_type: tokenType,
    expires_in: expiresIn
  }
  
  if (refreshToken) {
    response.refresh_token = refreshToken
  }
  
  if (scope) {
    response.scope = scope
  }
  
  return response
}

/**
 * Parse scope string into array
 * @param scope The scope string
 * @returns Array of scopes
 */
export function parseScope(scope?: string): string[] {
  if (!scope) return []
  return scope.split(' ').filter(s => s.trim().length > 0)
}

/**
 * Join scope array into string
 * @param scopes Array of scopes
 * @returns Scope string
 */
export function joinScope(scopes: string[]): string {
  return scopes.join(' ')
}

/**
 * Validate scope against allowed scopes
 * @param requestedScope The requested scope
 * @param allowedScopes The allowed scopes
 * @returns True if the scope is valid
 */
export function validateScope(requestedScope: string[], allowedScopes: string[]): boolean {
  return requestedScope.every(scope => allowedScopes.includes(scope))
}

/**
 * Get intersection of requested and allowed scopes
 * @param requestedScope The requested scope
 * @param allowedScopes The allowed scopes
 * @returns Intersection of scopes
 */
export function getScopeIntersection(requestedScope: string[], allowedScopes: string[]): string[] {
  return requestedScope.filter(scope => allowedScopes.includes(scope))
} 