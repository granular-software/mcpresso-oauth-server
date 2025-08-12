import crypto from 'crypto'
import { CodeChallengeMethod } from '../types.js'

/**
 * PKCE (Proof Key for Code Exchange) utilities
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

/**
 * Generate a random code verifier
 * @param length Length of the code verifier (43-128 characters)
 * @returns A random code verifier
 */
export function generateCodeVerifier(length: number = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('Code verifier length must be between 43 and 128 characters')
  }
  
  const bytes = crypto.randomBytes(length)
  return bytes.toString('base64url')
}

/**
 * Generate a code challenge from a code verifier
 * @param codeVerifier The code verifier
 * @param method The code challenge method ('S256' or 'plain')
 * @returns The code challenge
 */
export function generateCodeChallenge(
  codeVerifier: string, 
  method: CodeChallengeMethod = 'S256'
): string {
  if (method === 'plain') {
    return codeVerifier
  }
  
  if (method === 'S256') {
    const hash = crypto.createHash('sha256')
    hash.update(codeVerifier)
    return hash.digest('base64url')
  }
  
  throw new Error(`Unsupported code challenge method: ${method}`)
}

/**
 * Verify a code verifier against a code challenge
 * @param codeVerifier The code verifier
 * @param codeChallenge The code challenge
 * @param method The code challenge method
 * @returns True if the code verifier matches the challenge
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: CodeChallengeMethod
): boolean {
  const expectedChallenge = generateCodeChallenge(codeVerifier, method)
  return expectedChallenge === codeChallenge
}

/**
 * Validate code verifier format
 * @param codeVerifier The code verifier to validate
 * @returns True if the code verifier is valid
 */
export function isValidCodeVerifier(codeVerifier: string): boolean {
  // Must be 43-128 characters
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    return false
  }
  
  // Must only contain characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  const validChars = /^[A-Za-z0-9\-._~]+$/
  return validChars.test(codeVerifier)
}

/**
 * Validate code challenge format
 * @param codeChallenge The code challenge to validate
 * @returns True if the code challenge is valid
 */
export function isValidCodeChallenge(codeChallenge: string): boolean {
  // Must be 43-128 characters
  if (codeChallenge.length < 43 || codeChallenge.length > 128) {
    return false
  }
  
  // Must only contain characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  const validChars = /^[A-Za-z0-9\-._~]+$/
  return validChars.test(codeChallenge)
}

/**
 * Generate a complete PKCE pair
 * @param method The code challenge method
 * @param verifierLength Length of the code verifier
 * @returns Object containing code verifier and challenge
 */
export function generatePkcePair(
  method: CodeChallengeMethod = 'S256',
  verifierLength: number = 64
): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = generateCodeVerifier(verifierLength)
  const codeChallenge = generateCodeChallenge(codeVerifier, method)
  
  return {
    codeVerifier,
    codeChallenge
  }
} 