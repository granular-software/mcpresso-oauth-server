# User Management

This document describes how to manage users in the SQLite-based OAuth server.

## Overview

The system provides secure user management with password hashing using bcrypt. Users can be created, authenticated, and managed through the SQLite database.

## Features

- ✅ Secure password hashing with bcrypt (12 salt rounds)
- ✅ User creation with automatic ID generation
- ✅ Password verification
- ✅ Email and username-based user lookup
- ✅ OAuth integration
- ✅ Command-line tools for user management

## Database Schema

Users are stored in the `oauth_users` table with the following structure:

```sql
CREATE TABLE oauth_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  scopes TEXT NOT NULL,
  profile TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Methods

### SQLiteStorage Class

The `SQLiteStorage` class provides the following user management methods:

#### `createUserWithPassword(userData)`
Creates a new user with password hashing.

```typescript
const user = await storage.createUserWithPassword({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'securepassword123',
  scopes: ['read', 'write'],
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    role: 'user'
  }
});
```

#### `verifyUserPassword(userId, password)`
Verifies a user's password by user ID.

```typescript
const isValid = await storage.verifyUserPassword(userId, 'password123');
```

#### `verifyUserPasswordByEmail(email, password)`
Verifies a user's password by email address.

```typescript
const isValid = await storage.verifyUserPasswordByEmail('john@example.com', 'password123');
```

#### `getUser(userId)`
Retrieves a user by ID.

#### `getUserByEmail(email)`
Retrieves a user by email address.

#### `getUserByUsername(username)`
Retrieves a user by username.

## Command Line Tools

### Create a User

Create a user with default credentials:
```bash
npm run user:create
```

Create a user with custom credentials:
```bash
npm run user:create username email@example.com password123
```

Or use the script directly:
```bash
npx tsx scripts/create-user.js
npx tsx scripts/create-user.js admin admin@example.com securepassword123
```

### Test Password Verification

Test password functionality:
```bash
npm run user:test-password
```

Or use the script directly:
```bash
npx tsx scripts/test-password.js
```

### Test OAuth Authentication

Test the complete OAuth authentication flow:
```bash
npm run user:test-auth
```

Or use the script directly:
```bash
npx tsx scripts/test-auth.js
```

## OAuth Integration

Users created through the user management system can immediately authenticate through the OAuth flow:

1. Start the server: `npm run dev`
2. Navigate to: `http://localhost:3000`
3. Use the OAuth login form with your created credentials
4. The system will authenticate against the SQLite database

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt with 12 salt rounds
- **Unique IDs**: Each user gets a unique UUID
- **Email/Username Uniqueness**: Database enforces unique email and username constraints
- **Scope-based Access**: Users can have different permission scopes
- **Profile Data**: Flexible profile storage for additional user information

## Example Usage

### Creating a User Programmatically

```typescript
import { SQLiteStorage } from './src/storage/sqlite-storage.js';

const storage = new SQLiteStorage('data/app.db');
await storage.initialize();

// Create a new user
const user = await storage.createUserWithPassword({
  username: 'alice',
  email: 'alice@example.com',
  password: 'mypassword123',
  scopes: ['read', 'write'],
  profile: {
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'admin'
  }
});

console.log('User created:', user.id);
```

### Verifying a Password

```typescript
// Verify password by email
const isValid = await storage.verifyUserPasswordByEmail('alice@example.com', 'mypassword123');
console.log('Password valid:', isValid);
```

## Database Initialization

Before using user management, ensure the database is initialized:

```bash
npm run db:init
```

This creates the necessary tables and indexes for user management.

## Troubleshooting

### Common Issues

1. **Database not found**: Run `npm run db:init` to create the database
2. **Import errors**: Ensure you're using `tsx` to run TypeScript files
3. **Password verification fails**: Check that the user exists and the password is correct

### Debugging

Enable debug logging by setting the environment variable:
```bash
LOG_LEVEL=debug npm run dev
```

## Next Steps

- [ ] Add user update functionality
- [ ] Add user deletion functionality
- [ ] Add password reset functionality
- [ ] Add user role management
- [ ] Add audit logging 