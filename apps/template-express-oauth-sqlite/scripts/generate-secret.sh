#!/bin/bash

echo "🔐 JWT Secret Generation"
echo "Generate a secure JWT secret for your application."
echo ""

# Generate JWT secret using openssl (64 bytes = 512 bits)
JWT_SECRET=$(openssl rand -hex 64)

echo "Generated JWT secret:"
echo "$JWT_SECRET"
echo ""

# Check if JWT_SECRET already exists and warn user
if [ -f .env ] && grep -q "^JWT_SECRET=" .env; then
    CURRENT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d'=' -f2- || echo "")
    if [ ! -z "$CURRENT_SECRET" ] && [ "$CURRENT_SECRET" != "your-secure-secret-key-change-this-in-production" ]; then
        echo "⚠️  A JWT secret is already configured."
        echo "Replacing it will invalidate all existing tokens."
        echo ""
    fi
fi

# Update .env file
if [ -f .env ]; then
    if grep -q "^JWT_SECRET=" .env; then
        # Replace existing JWT_SECRET
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        else
            sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        fi
    else
        # Append JWT_SECRET
        echo "JWT_SECRET=$JWT_SECRET" >> .env
    fi
else
    # Create new .env file
    echo "JWT_SECRET=$JWT_SECRET" > .env
fi

echo "✅ JWT secret configured successfully"
echo "Updated: $(pwd)/.env"
echo ""
echo "💡 Important notes:"
echo "• Keep this secret secure and never commit it to version control"
echo "• Changing the secret will invalidate all existing user sessions"
echo "• Make sure to set different secrets for different environments"