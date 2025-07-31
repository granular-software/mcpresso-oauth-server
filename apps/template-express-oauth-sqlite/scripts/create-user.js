#!/usr/bin/env node

import { SQLiteStorage } from '../src/storage/sqlite-storage.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'app.db');

async function createUser() {
  try {
    console.log('👤 Creating a new user...');
    console.log(`📁 Database path: ${dbPath}`);
    
    // Initialize storage
    const storage = new SQLiteStorage(dbPath);
    await storage.initialize();
    console.log('✅ Database initialized');
    
    // Get user data from command line arguments or use defaults
    const username = process.argv[2] || 'testuser';
    const email = process.argv[3] || 'test@example.com';
    const password = process.argv[4] || 'password123';
    
    console.log(`\n📝 User details:`);
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${'*'.repeat(password.length)}`);
    
    // Create user with password hashing
    const user = await storage.createUserWithPassword({
      username,
      email,
      password,
      scopes: ['read', 'write'],
      profile: {
        firstName: 'Test',
        lastName: 'User',
        role: 'user'
      }
    });
    
    console.log('\n✅ User created successfully!');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Scopes: ${user.scopes.join(', ')}`);
    console.log(`   Created: ${user.createdAt.toISOString()}`);
    
    console.log('\n💡 You can now use these credentials to log in through the OAuth flow');
    console.log(`   Server URL: http://localhost:${process.env.PORT || 3000}`);
    
  } catch (error) {
    console.error('\n❌ Error creating user:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createUser();
} 