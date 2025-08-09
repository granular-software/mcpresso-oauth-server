#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'app.db');

console.log('🗄️  Initializing SQLite database...');
console.log(`📁 Database path: ${dbPath}`);

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`📁 Created data directory: ${dataDir}`);
}

// Create database connection
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables
const tables = [
  {
    name: 'oauth_users',
    sql: `
      CREATE TABLE IF NOT EXISTS oauth_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        hashed_password TEXT,
        scopes TEXT NOT NULL,
        profile TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    description: 'User accounts with authentication'
  },
  {
    name: 'notes',
    sql: `
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        author_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES oauth_users(id) ON DELETE CASCADE
      )
    `,
    description: 'User notes with author relationship'
  },
  {
    name: 'oauth_clients',
    sql: `
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        redirect_uris TEXT NOT NULL,
        scopes TEXT NOT NULL,
        grant_types TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    description: 'OAuth clients metadata'
  },
  {
    name: 'oauth_authorization_codes',
    sql: `
      CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
        code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        scope TEXT NOT NULL,
        resource TEXT,
        code_challenge TEXT,
        code_challenge_method TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    description: 'OAuth authorization codes'
  },
  {
    name: 'oauth_access_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS oauth_access_tokens (
        access_token TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    description: 'OAuth access tokens'
  },
  {
    name: 'oauth_refresh_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
        refresh_token TEXT PRIMARY KEY,
        access_token_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    description: 'OAuth refresh tokens'
  }
];

// Create tables
async function createTables() {
  console.log('\n📋 Creating database tables:');
  
  for (const table of tables) {
    console.log(`  🗂️  Creating table: ${table.name}`);
    console.log(`     Description: ${table.description}`);
    
    await new Promise((resolve, reject) => {
      db.run(table.sql, (err) => {
        if (err) {
          console.error(`     ❌ Error creating ${table.name}:`, err.message);
          reject(err);
        } else {
          console.log(`     ✅ Created table: ${table.name}`);
          resolve();
        }
      });
    });
  }
}

// Create indexes
async function createIndexes() {
  console.log('\n🔍 Creating database indexes:');
  
  const indexes = [
    {
      name: 'idx_users_email',
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      description: 'Email lookup index'
    },
    {
      name: 'idx_users_username', 
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      description: 'Username lookup index'
    },
    {
      name: 'idx_sessions_userId',
      sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId)',
      description: 'User sessions index'
    },
    {
      name: 'idx_sessions_accessToken',
      sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_accessToken ON sessions(accessToken)',
      description: 'Access token lookup index'
    },
    {
      name: 'idx_notes_authorId',
      sql: 'CREATE INDEX IF NOT EXISTS idx_notes_authorId ON notes(authorId)',
      description: 'Notes by author index'
    }
    ,
    { name: 'idx_oauth_clients_id', sql: 'CREATE INDEX IF NOT EXISTS idx_oauth_clients_id ON oauth_clients(id)', description: 'OAuth clients id index' },
    { name: 'idx_oauth_authorization_codes_code', sql: 'CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_code ON oauth_authorization_codes(code)', description: 'Auth codes code index' },
    { name: 'idx_oauth_access_tokens_token', sql: 'CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_token ON oauth_access_tokens(accessToken)', description: 'Access tokens index' },
    { name: 'idx_oauth_refresh_tokens_token', sql: 'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(refreshToken)', description: 'Refresh tokens index' }
  ];
  
  for (const index of indexes) {
    console.log(`  🔍 Creating index: ${index.name}`);
    console.log(`     Description: ${index.description}`);
    
    await new Promise((resolve, reject) => {
      db.run(index.sql, (err) => {
        if (err) {
          console.error(`     ❌ Error creating ${index.name}:`, err.message);
          reject(err);
        } else {
          console.log(`     ✅ Created index: ${index.name}`);
          resolve();
        }
      });
    });
  }
}

// Main execution
async function initDatabase() {
  try {
    console.log('🚀 Starting database initialization...\n');
    
    await createTables();
    await createIndexes();
    
    console.log('\n✅ Database initialization completed successfully!');
    console.log('\n📊 Database structure:');
    console.log('   • users - User accounts and authentication');
    console.log('   • sessions - OAuth sessions and tokens');
    console.log('   • notes - User notes with author relationships');
    console.log('\n🔍 Available indexes:');
    console.log('   • Email and username lookups');
    console.log('   • Session and token lookups');
    console.log('   • Notes by author');
    
    console.log('\n💡 Next steps:');
    console.log('   • Start the server: npm run dev');
    console.log('   • Create your first user through the OAuth flow');
    console.log('   • Test the API endpoints');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
} 