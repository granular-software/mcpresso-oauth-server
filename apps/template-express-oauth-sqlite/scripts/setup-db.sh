#!/bin/bash

echo "🗄️  SQLite Database Setup"
echo "Initialize your SQLite database and schema."
echo ""

echo "SQLite database will be created automatically."
echo "Default location: data/app.db"
echo ""

# Run the database initialization
echo "🚀 Initializing SQLite database..."
node scripts/init-db.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup completed successfully!"
else
    echo ""
    echo "❌ Database initialization failed."
    exit 1
fi