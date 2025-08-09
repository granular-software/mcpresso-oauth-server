import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

import type { MCPOAuthStorage, OAuthClient, OAuthUser, AuthorizationCode, AccessToken, RefreshToken } from "mcpresso-oauth-server";

export class SQLiteStorage implements MCPOAuthStorage {
	private db: sqlite3.Database | null = null;

	constructor(private dbPath: string) {}

	async initialize(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db = new sqlite3.Database(this.dbPath, (err) => {
				if (err) {
					reject(err);
					return;
				}

				// Validate required tables exist; if not, instruct to run init script
				const requiredTables = [
					"oauth_users",
					"oauth_clients",
					"oauth_authorization_codes",
					"oauth_access_tokens",
					"oauth_refresh_tokens",
				];

				const checks = requiredTables.map(
					(table) =>
						new Promise<void>((res, rej) => {
							this.db!.get(
								"SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
								[table],
								(err, row) => {
									if (err) return rej(err);
									if (!row) return rej(new Error("missing:" + table));
									res();
								},
							);
						}),
				);

				Promise.all(checks)
					.then(() => resolve())
					.catch((e) => {
						const missing = e.message?.startsWith("missing:") ? e.message.replace("missing:", "") : "some tables";
						reject(new Error(`Database schema is incomplete (missing: ${missing}). Please run: npm run db:init`));
					});
			});
		});
	}

	// ===== CLIENT MANAGEMENT =====

	async createClient(client: OAuthClient): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run(
				`
        INSERT OR REPLACE INTO oauth_clients 
        (id, secret, name, type, redirect_uris, scopes, grant_types, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
				[client.id, client.secret, client.name, client.type, JSON.stringify(client.redirectUris), JSON.stringify(client.scopes), JSON.stringify(client.grantTypes)],
				(err) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});
	}

	async getClient(clientId: string): Promise<OAuthClient | null> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.get("SELECT * FROM oauth_clients WHERE id = ?", [clientId], (err, row: any) => {
				if (err) {
					reject(err);
					return;
				}
				if (!row) {
					resolve(null);
					return;
				}

				resolve({
					id: row.id,
					secret: row.secret,
					name: row.name,
					type: row.type,
					redirectUris: JSON.parse(row.redirect_uris),
					scopes: JSON.parse(row.scopes),
					grantTypes: JSON.parse(row.grant_types),
					createdAt: new Date(row.created_at),
					updatedAt: new Date(row.updated_at),
				});
			});
		});
	}

	async listClients(): Promise<OAuthClient[]> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.all("SELECT * FROM oauth_clients ORDER BY created_at DESC", (err, rows: any[]) => {
				if (err) {
					reject(err);
					return;
				}

				resolve(
					rows.map((row) => ({
						id: row.id,
						secret: row.secret,
						name: row.name,
						type: row.type,
						redirectUris: JSON.parse(row.redirect_uris),
						scopes: JSON.parse(row.scopes),
						grantTypes: JSON.parse(row.grant_types),
						createdAt: new Date(row.created_at),
						updatedAt: new Date(row.updated_at),
					})),
				);
			});
		});
	}

	async updateClient(clientId: string, updates: Partial<OAuthClient>): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const fields = [];
			const values = [];

			if (updates.secret !== undefined) {
				fields.push("secret = ?");
				values.push(updates.secret);
			}
			if (updates.name !== undefined) {
				fields.push("name = ?");
				values.push(updates.name);
			}
			if (updates.type !== undefined) {
				fields.push("type = ?");
				values.push(updates.type);
			}
			if (updates.redirectUris !== undefined) {
				fields.push("redirect_uris = ?");
				values.push(JSON.stringify(updates.redirectUris));
			}
			if (updates.scopes !== undefined) {
				fields.push("scopes = ?");
				values.push(JSON.stringify(updates.scopes));
			}
			if (updates.grantTypes !== undefined) {
				fields.push("grant_types = ?");
				values.push(JSON.stringify(updates.grantTypes));
			}

			fields.push("updated_at = CURRENT_TIMESTAMP");
			values.push(clientId);

			const query = `UPDATE oauth_clients SET ${fields.join(", ")} WHERE id = ?`;
			this.db.run(query, values, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async deleteClient(clientId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run("DELETE FROM oauth_clients WHERE id = ?", [clientId], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	// ===== USER MANAGEMENT =====

	async createUser(user: OAuthUser): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run(
				`
        INSERT OR REPLACE INTO oauth_users 
        (id, username, email, hashed_password, scopes, profile, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
				[user.id, user.username, user.email, user.hashedPassword, JSON.stringify(user.scopes), user.profile ? JSON.stringify(user.profile) : null],
				(err) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});
	}

	/**
	 * Create a new user with password hashing
	 * @param userData User data with plain text password
	 * @returns The created user object
	 */
	async createUserWithPassword(userData: { username: string; email: string; password: string; scopes?: string[]; profile?: any }): Promise<OAuthUser> {
		// Generate a unique ID for the user
		const userId = randomUUID();

		// Hash the password with bcrypt (salt rounds: 12)
		const hashedPassword = await bcrypt.hash(userData.password, 12);

		// Create the user object
		const user: OAuthUser = {
			id: userId,
			username: userData.username,
			email: userData.email,
			hashedPassword: hashedPassword,
			scopes: userData.scopes || ["read", "write"],
			profile: userData.profile || null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		// Save to database
		await this.createUser(user);

		return user;
	}

	/**
	 * Verify a user's password
	 * @param userId User ID to verify password for
	 * @param password Plain text password to verify
	 * @returns true if password is correct, false otherwise
	 */
	async verifyUserPassword(userId: string, password: string): Promise<boolean> {
		const user = await this.getUser(userId);
		if (!user) {
			return false;
		}

		return bcrypt.compare(password, user.hashedPassword);
	}

	/**
	 * Verify a user's password by email
	 * @param email User email to verify password for
	 * @param password Plain text password to verify
	 * @returns true if password is correct, false otherwise
	 */
	async verifyUserPasswordByEmail(email: string, password: string): Promise<boolean> {
		const user = await this.getUserByEmail(email);
		if (!user) {
			return false;
		}

		return bcrypt.compare(password, user.hashedPassword);
	}

	async getUser(userId: string): Promise<OAuthUser | null> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.get("SELECT * FROM oauth_users WHERE id = ?", [userId], (err, row: any) => {
				if (err) {
					reject(err);
					return;
				}
				if (!row) {
					resolve(null);
					return;
				}

				resolve({
					id: row.id,
					username: row.username,
					email: row.email,
					hashedPassword: row.hashed_password,
					scopes: JSON.parse(row.scopes),
					profile: row.profile ? JSON.parse(row.profile) : null,
					createdAt: new Date(row.created_at),
					updatedAt: new Date(row.updated_at),
				});
			});
		});
	}

	async getUserByUsername(username: string): Promise<OAuthUser | null> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.get("SELECT * FROM oauth_users WHERE username = ?", [username], (err, row: any) => {
				if (err) {
					reject(err);
					return;
				}
				if (!row) {
					resolve(null);
					return;
				}

				resolve({
					id: row.id,
					username: row.username,
					email: row.email,
					hashedPassword: row.hashed_password,
					scopes: JSON.parse(row.scopes),
					profile: row.profile ? JSON.parse(row.profile) : null,
					createdAt: new Date(row.created_at),
					updatedAt: new Date(row.updated_at),
				});
			});
		});
	}

	async getUserById(userId: string): Promise<OAuthUser | null> {
		return this.getUser(userId);
	}

	async getUserByEmail(email: string): Promise<OAuthUser | null> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.get("SELECT * FROM oauth_users WHERE email = ?", [email], (err, row: any) => {
				if (err) {
					reject(err);
					return;
				}
				if (!row) {
					resolve(null);
					return;
				}

				resolve({
					id: row.id,
					username: row.username,
					email: row.email,
					hashedPassword: row.hashed_password,
					scopes: JSON.parse(row.scopes),
					profile: row.profile ? JSON.parse(row.profile) : null,
					createdAt: new Date(row.created_at),
					updatedAt: new Date(row.updated_at),
				});
			});
		});
	}

	async listUsers(): Promise<OAuthUser[]> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.all("SELECT * FROM oauth_users ORDER BY created_at DESC", (err, rows: any[]) => {
				if (err) {
					reject(err);
					return;
				}

				resolve(
					rows.map((row) => ({
						id: row.id,
						username: row.username,
						email: row.email,
						hashedPassword: row.hashed_password,
						scopes: JSON.parse(row.scopes),
						profile: row.profile ? JSON.parse(row.profile) : null,
						createdAt: new Date(row.created_at),
						updatedAt: new Date(row.updated_at),
					})),
				);
			});
		});
	}

	async updateUser(userId: string, updates: Partial<OAuthUser>): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const fields = [];
			const values = [];

			if (updates.username !== undefined) {
				fields.push("username = ?");
				values.push(updates.username);
			}
			if (updates.email !== undefined) {
				fields.push("email = ?");
				values.push(updates.email);
			}
			if (updates.hashedPassword !== undefined) {
				fields.push("hashed_password = ?");
				values.push(updates.hashedPassword);
			}
			if (updates.scopes !== undefined) {
				fields.push("scopes = ?");
				values.push(JSON.stringify(updates.scopes));
			}
			if (updates.profile !== undefined) {
				fields.push("profile = ?");
				values.push(updates.profile ? JSON.stringify(updates.profile) : null);
			}

			fields.push("updated_at = CURRENT_TIMESTAMP");
			values.push(userId);

			const query = `UPDATE oauth_users SET ${fields.join(", ")} WHERE id = ?`;
			this.db.run(query, values, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async deleteUser(userId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run("DELETE FROM oauth_users WHERE id = ?", [userId], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	// ===== AUTHORIZATION CODES =====

	async createAuthorizationCode(code: AuthorizationCode): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run(
				`
        INSERT INTO oauth_authorization_codes 
        (code, client_id, user_id, redirect_uri, scope, resource, code_challenge, code_challenge_method, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
				[code.code, code.clientId, code.userId, code.redirectUri, JSON.stringify(code.scope), code.resource, code.codeChallenge, code.codeChallengeMethod, code.expiresAt.toISOString()],
				(err) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});
	}

	async getAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.get('SELECT * FROM oauth_authorization_codes WHERE code = ? AND expires_at > datetime("now")', [code], (err, row: any) => {
				if (err) {
					reject(err);
					return;
				}
				if (!row) {
					resolve(null);
					return;
				}

				resolve({
					code: row.code,
					clientId: row.client_id,
					userId: row.user_id,
					redirectUri: row.redirect_uri,
					scope: JSON.parse(row.scope),
					resource: row.resource,
					codeChallenge: row.code_challenge,
					codeChallengeMethod: row.code_challenge_method,
					expiresAt: new Date(row.expires_at),
					createdAt: new Date(row.created_at),
				});
			});
		});
	}

	async deleteAuthorizationCode(code: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run("DELETE FROM oauth_authorization_codes WHERE code = ?", [code], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async cleanupExpiredCodes(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run('DELETE FROM oauth_authorization_codes WHERE expires_at <= datetime("now")', (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	// ===== ACCESS TOKENS =====

	async createAccessToken(token: AccessToken): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run(
				`
        INSERT INTO oauth_access_tokens 
        (access_token, client_id, user_id, scope, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `,
				[token.token, token.clientId, token.userId, JSON.stringify(token.scope), token.expiresAt.toISOString()],
				(err) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});
	}

	async getAccessToken(token: string): Promise<AccessToken | null> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.get('SELECT * FROM oauth_access_tokens WHERE access_token = ? AND expires_at > datetime("now")', [token], (err, row: any) => {
				if (err) {
					reject(err);
					return;
				}
				if (!row) {
					resolve(null);
					return;
				}

				resolve({
					token: row.access_token,
					clientId: row.client_id,
					userId: row.user_id,
					scope: JSON.parse(row.scope),
					expiresAt: new Date(row.expires_at),
					createdAt: new Date(row.created_at),
				});
			});
		});
	}

	async deleteAccessToken(token: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run("DELETE FROM oauth_access_tokens WHERE access_token = ?", [token], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async cleanupExpiredTokens(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run('DELETE FROM oauth_access_tokens WHERE expires_at <= datetime("now")', (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	// ===== REFRESH TOKENS =====

	async createRefreshToken(token: RefreshToken): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run(
				`
        INSERT INTO oauth_refresh_tokens 
        (refresh_token, access_token_id, client_id, user_id, scope, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
				[token.token, token.accessTokenId, token.clientId, token.userId, JSON.stringify(token.scope), token.expiresAt.toISOString()],
				(err) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});
	}

	async getRefreshToken(token: string): Promise<RefreshToken | null> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.get('SELECT * FROM oauth_refresh_tokens WHERE refresh_token = ? AND expires_at > datetime("now")', [token], (err, row: any) => {
				if (err) {
					reject(err);
					return;
				}
				if (!row) {
					resolve(null);
					return;
				}

				resolve({
					token: row.refresh_token,
					accessTokenId: row.access_token_id,
					clientId: row.client_id,
					userId: row.user_id,
					scope: JSON.parse(row.scope),
					expiresAt: new Date(row.expires_at),
					createdAt: new Date(row.created_at),
				});
			});
		});
	}

	async deleteRefreshToken(token: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run("DELETE FROM oauth_refresh_tokens WHERE refresh_token = ?", [token], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async deleteRefreshTokensByAccessToken(accessTokenId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run("DELETE FROM oauth_refresh_tokens WHERE access_token_id = ?", [accessTokenId], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async cleanupExpiredRefreshTokens(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			this.db.run('DELETE FROM oauth_refresh_tokens WHERE expires_at <= datetime("now")', (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	// ===== UTILITY METHODS =====

	getStats(): { clients: number; users: number; authorizationCodes: number; accessTokens: number; refreshTokens: number } {
		// Note: This is a synchronous method that returns cached stats
		// For real-time stats, you would need to implement a separate async method
		return {
			clients: 0, // Would need to be implemented with caching
			users: 0,
			authorizationCodes: 0,
			accessTokens: 0,
			refreshTokens: 0,
		};
	}

	async close(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				resolve();
				return;
			}

			this.db.close((err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}
}
