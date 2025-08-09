#!/bin/bash

echo "🗄️  PostgreSQL Database Setup"
echo "Configure your database connection and initialize the schema."
echo ""

# Check if .env exists and get current DATABASE_URL
if [ -f .env ]; then
    CURRENT_URL=$(grep "^DATABASE_URL=" .env 2>/dev/null | cut -d'=' -f2- || echo "")
    if [ ! -z "$CURRENT_URL" ]; then
        echo "Current DATABASE_URL: $CURRENT_URL"
    fi
fi

echo ""
echo "Please provide your PostgreSQL connection string:"
echo "Format: postgresql://username:password@host:port/database"
echo "Example: postgresql://postgres:mypassword@localhost:5432/myapp"
echo ""

# Prompt for database URL
read -p "PostgreSQL connection string: " DATABASE_URL

# Validate URL format
if [[ ! $DATABASE_URL =~ ^postgresql:// ]] && [[ ! $DATABASE_URL =~ ^postgres:// ]]; then
    echo "❌ Error: URL must start with postgresql:// or postgres://"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: Database URL is required"
    exit 1
fi

# Update .env file
if [ -f .env ]; then
    if grep -q "^DATABASE_URL=" .env; then
        # Replace existing DATABASE_URL
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env
        else
            sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env
        fi
    else
        # Append DATABASE_URL
        echo "DATABASE_URL=$DATABASE_URL" >> .env
    fi
else
    # Create new .env file
    echo "DATABASE_URL=$DATABASE_URL" > .env
fi

echo "✅ Database URL configured successfully"
echo ""

# Run the database initialization
echo "🚀 Initializing database schema..."
node scripts/init-db.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup completed successfully!"
else
    echo ""
    echo "❌ Database initialization failed. Please check your connection string and database server."
    exit 1
fi