#!/usr/bin/env node

import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  for (const line of envVars) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  }
} catch (error) {
  console.log('📝 No .env file found, using existing environment variables');
}

const { Pool } = pg;

console.log('🗄️  Initializing PostgreSQL database...');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create tables
const tables = [
  {
    name: 'users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        scopes TEXT[] DEFAULT ARRAY['read', 'write'],
        profile JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `,
    description: 'User accounts with authentication and OAuth support'
  },
  {
    name: 'sessions',
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        access_token VARCHAR(255) UNIQUE NOT NULL,
        refresh_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    description: 'OAuth sessions and tokens'
  },
  {
    name: 'notes',
    sql: `
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT,
        author_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    description: 'User notes with author relationship'
  }
];

// Create indexes
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
    name: 'idx_sessions_user_id',
    sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
    description: 'User sessions index'
  },
  {
    name: 'idx_sessions_access_token',
    sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_access_token ON sessions(access_token)',
    description: 'Access token lookup index'
  },
  {
    name: 'idx_notes_author_id',
    sql: 'CREATE INDEX IF NOT EXISTS idx_notes_author_id ON notes(author_id)',
    description: 'Notes by author index'
  }
];

// Create functions
const functions = [
  {
    name: 'update_updated_at_column',
    sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `,
    description: 'Function to automatically update updated_at timestamp'
  }
];

// Create triggers
const triggers = [
  {
    name: 'trigger_users_updated_at',
    sql: `
      DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
      CREATE TRIGGER trigger_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `,
    description: 'Auto-update users.updated_at'
  },
  {
    name: 'trigger_notes_updated_at',
    sql: `
      DROP TRIGGER IF EXISTS trigger_notes_updated_at ON notes;
      CREATE TRIGGER trigger_notes_updated_at
        BEFORE UPDATE ON notes
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `,
    description: 'Auto-update notes.updated_at'
  }
];

// Create tables
async function createTables() {
  console.log('\n📋 Creating database tables:');
  
  for (const table of tables) {
    console.log(`  🗂️  Creating table: ${table.name}`);
    console.log(`     Description: ${table.description}`);
    
    try {
      await pool.query(table.sql);
      console.log(`     ✅ Created table: ${table.name}`);
      
      // For users table, ensure it has the new columns
      if (table.name === 'users') {
        try {
          await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT ARRAY[\'read\', \'write\']');
          await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB');
          console.log(`     ✅ Ensured users table has OAuth columns`);
        } catch (alterError) {
          console.log(`     ℹ️  Users table columns already up to date`);
        }
      }
    } catch (error) {
      console.error(`     ❌ Error creating ${table.name}:`, error.message);
      throw error;
    }
  }
}

// Create functions
async function createFunctions() {
  console.log('\n⚙️  Creating database functions:');
  
  for (const func of functions) {
    console.log(`  ⚙️  Creating function: ${func.name}`);
    console.log(`     Description: ${func.description}`);
    
    try {
      await pool.query(func.sql);
      console.log(`     ✅ Created function: ${func.name}`);
    } catch (error) {
      console.error(`     ❌ Error creating ${func.name}:`, error.message);
      throw error;
    }
  }
}

// Create triggers
async function createTriggers() {
  console.log('\n🔗 Creating database triggers:');
  
  for (const trigger of triggers) {
    console.log(`  🔗 Creating trigger: ${trigger.name}`);
    console.log(`     Description: ${trigger.description}`);
    
    try {
      await pool.query(trigger.sql);
      console.log(`     ✅ Created trigger: ${trigger.name}`);
    } catch (error) {
      console.error(`     ❌ Error creating ${trigger.name}:`, error.message);
      throw error;
    }
  }
}

// Create indexes
async function createIndexes() {
  console.log('\n🔍 Creating database indexes:');
  
  for (const index of indexes) {
    console.log(`  🔍 Creating index: ${index.name}`);
    console.log(`     Description: ${index.description}`);
    
    try {
      await pool.query(index.sql);
      console.log(`     ✅ Created index: ${index.name}`);
    } catch (error) {
      console.error(`     ❌ Error creating ${index.name}:`, error.message);
      throw error;
    }
  }
}

// Main execution
async function initDatabase() {
  try {
    console.log('🚀 Starting database initialization...\n');
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    await createTables();
    await createFunctions();
    await createTriggers();
    await createIndexes();
    
    console.log('\n✅ Database initialization completed successfully!');
    console.log('\n📊 Database structure:');
    console.log('   • users - User accounts with UUID primary keys');
    console.log('   • sessions - OAuth sessions and tokens');
    console.log('   • notes - User notes with author relationships');
    console.log('\n🔍 Available indexes:');
    console.log('   • Email and username lookups');
    console.log('   • Session and token lookups');
    console.log('   • Notes by author');
    console.log('\n⚙️  Database features:');
    console.log('   • UUID primary keys for all tables');
    console.log('   • Automatic updated_at timestamps');
    console.log('   • Foreign key constraints with CASCADE');
    console.log('   • Optimized indexes for performance');
    
    console.log('\n💡 Next steps:');
    console.log('   • Start the server: npm run dev');
    console.log('   • Create your first user through the OAuth flow');
    console.log('   • Test the API endpoints');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
} 