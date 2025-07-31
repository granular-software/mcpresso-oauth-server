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
    name: 'users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        hashedPassword TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    description: 'User accounts with authentication'
  },
  {
    name: 'sessions',
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        accessToken TEXT UNIQUE NOT NULL,
        refreshToken TEXT UNIQUE NOT NULL,
        expiresAt DATETIME NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    description: 'OAuth sessions and tokens'
  },
  {
    name: 'notes',
    sql: `
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        authorId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    description: 'User notes with author relationship'
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