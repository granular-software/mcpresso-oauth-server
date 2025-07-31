#!/usr/bin/env node

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

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

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createUser(name, email, password) {
  try {
    console.log('👤 Creating new user...');
    console.log(`   Name: ${name}`);
    console.log(`   Email: ${email}`);
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, name]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('❌ User already exists with this email or username');
      return;
    }
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const userId = randomUUID();
    const query = `
      INSERT INTO users (id, username, email, hashed_password, scopes, profile)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await pool.query(query, [
      userId,
      name,
      email,
      hashedPassword,
      ['read', 'write'], // Default scopes
      JSON.stringify({ name, email }) // Basic profile
    ]);
    
    console.log('✅ User created successfully!');
    console.log(`   User ID: ${userId}`);
    console.log(`   Username: ${name}`);
    console.log(`   Email: ${email}`);
    console.log(`   Scopes: read, write`);
    
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.log('Usage: npm run user:create <name> <email> <password>');
    console.log('Example: npm run user:create "John Doe" "john@example.com" "mypassword"');
    process.exit(1);
  }
  
  const [name, email, password] = args;
  
  try {
    await createUser(name, email, password);
  } catch (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 