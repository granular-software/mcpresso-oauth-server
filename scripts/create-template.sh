#!/bin/bash

# Template Creation Script for mcpresso CLI
# This script creates a complete template from scratch:
# 1. Creates GitHub repository
# 2. Generates template files
# 3. Sets up subtrees in main repo
# 4. Updates CLI template manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ORGANIZATION="granular-software"
TEMPLATE_PREFIX="template-"
MAIN_REPO_PATH="/Users/arthurhirel/Documents/joshu/joshu"
MCPRESSO_PATH="$MAIN_REPO_PATH/packages/mcpresso"

# Function to print colored output
print_status() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print verbose output
verbose_log() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}🔍 DEBUG: $1${NC}"
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if template ID is already in use
check_template_id_availability() {
    local template_id="$1"
    local full_id="${TEMPLATE_PREFIX}${template_id}"
    
    # Check if template directory already exists
    if [ -d "$MAIN_REPO_PATH/apps/$full_id" ]; then
        print_error "Template ID '$template_id' is already in use"
        print_error "Directory exists: apps/$full_id"
        return 1
    fi
    
    # Check if GitHub repository already exists
    if gh repo view "$ORGANIZATION/$full_id" >/dev/null 2>&1; then
        print_error "GitHub repository already exists: $ORGANIZATION/$full_id"
        return 1
    fi
    
    return 0
}

# Function to check script environment
check_script_environment() {
    print_status "Checking script environment..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
        print_error "This script must be run from the joshu repository root directory"
        print_error "Current directory: $(pwd)"
        print_error "Expected to find: package.json and apps/ directory"
        exit 1
    fi
    
    # Check if mcpresso package exists
    if [ ! -d "packages/mcpresso" ]; then
        print_error "mcpresso package not found in packages/mcpresso"
        exit 1
    fi
    
    print_success "Script environment verified"
}

# Function to check GitHub organization access
check_github_access() {
    print_status "Checking GitHub organization access..."
    
    # Check if user is authenticated
    if ! gh auth status >/dev/null 2>&1; then
        print_error "GitHub CLI not authenticated. Please run:"
        echo "  gh auth login"
        exit 1
    fi
    
    # Check if user has access to the organization
    if ! gh api "orgs/$ORGANIZATION" >/dev/null 2>&1; then
        print_error "Cannot access organization: $ORGANIZATION"
        print_error "Please check your permissions or organization membership"
        exit 1
    fi
    
    # Check if user can create repositories in the organization
    if ! gh api "orgs/$ORGANIZATION/repos" >/dev/null 2>&1; then
        print_error "Cannot list repositories in organization: $ORGANIZATION"
        print_error "Please check your permissions"
        exit 1
    fi
    
    print_success "GitHub organization access verified"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists gh; then
        print_error "GitHub CLI (gh) is not installed. Please install it first:"
        echo "  brew install gh"
        echo "  gh auth login"
        exit 1
    fi
    
    if ! command_exists git; then
        print_error "Git is not installed"
        exit 1
    fi
    
    if ! command_exists node; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check GitHub access
    check_github_access
    
    print_success "All prerequisites are installed"
}

# Function to get template configuration
get_template_config() {
    echo "Enter template configuration:"
    echo ""
    
    while true; do
        read -p "Template ID (e.g., express-jwt-memory): " TEMPLATE_ID
        if check_template_id_availability "$TEMPLATE_ID"; then
            break
        fi
        echo "Please choose a different template ID."
    done
    
    read -p "Template Name (e.g., Express + JWT + Memory): " TEMPLATE_NAME
    read -p "Template Description: " TEMPLATE_DESCRIPTION
    read -p "Category (express/docker/cloud): " TEMPLATE_CATEGORY
    read -p "Auth Type (oauth/token/none): " TEMPLATE_AUTH_TYPE
    read -p "Complexity (easy/medium/hard): " TEMPLATE_COMPLEXITY
    
    # Validate inputs
    if [[ -z "$TEMPLATE_ID" || -z "$TEMPLATE_NAME" || -z "$TEMPLATE_DESCRIPTION" ]]; then
        print_error "All fields are required"
        exit 1
    fi
    
    # Set default values if empty
    TEMPLATE_CATEGORY=${TEMPLATE_CATEGORY:-express}
    TEMPLATE_AUTH_TYPE=${TEMPLATE_AUTH_TYPE:-none}
    TEMPLATE_COMPLEXITY=${TEMPLATE_COMPLEXITY:-easy}
    
    # Create full template ID
    FULL_TEMPLATE_ID="${TEMPLATE_PREFIX}${TEMPLATE_ID}"
    GITHUB_REPO="${ORGANIZATION}/${FULL_TEMPLATE_ID}"
}

# Function to create GitHub repository
create_github_repo() {
    print_status "Creating GitHub repository: $GITHUB_REPO"
    
    # Check if repo already exists
    if gh repo view "$GITHUB_REPO" >/dev/null 2>&1; then
        print_warning "Repository $GITHUB_REPO already exists"
        if [ "$SKIP_CONFIRM" = false ]; then
            read -p "Do you want to continue? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        else
            print_status "Continuing with existing repository due to --yes flag"
        fi
    else
        gh repo create "$GITHUB_REPO" \
            --public \
            --description "$TEMPLATE_DESCRIPTION" \
            --clone
        print_success "GitHub repository created"
    fi
}

# Function to generate template files
generate_template_files() {
    print_status "Generating template files..."
    
    local template_dir="$MAIN_REPO_PATH/apps/$FULL_TEMPLATE_ID"
    
    # Ensure apps directory exists
    mkdir -p "$MAIN_REPO_PATH/apps"
    
    # Remove existing directory if it exists
    if [ -d "$template_dir" ]; then
        print_warning "Template directory already exists, removing it..."
        rm -rf "$template_dir"
    fi
    
    mkdir -p "$template_dir"
    cd "$template_dir"
    
    # Create template.json
    cat > template.json << EOF
{
  "name": "$TEMPLATE_NAME",
  "description": "$TEMPLATE_DESCRIPTION",
  "version": "1.0.0",
  "mcpressoVersion": "^0.7.0",
  "category": "$TEMPLATE_CATEGORY",
  "authType": "$TEMPLATE_AUTH_TYPE",
  "complexity": "$TEMPLATE_COMPLEXITY",
  "features": [
    "MCP server",
    "TypeScript",
    "Production ready"
  ],
  "requirements": [
    "Node.js 18+",
    "npm or yarn"
  ],
  "envVars": [
    {
      "name": "PORT",
      "description": "Server port",
      "required": false,
      "default": "3000"
    },
    {
      "name": "SERVER_URL",
      "description": "Base URL of your server",
      "required": true
    }
  ]
}
EOF

    # Create package.json
    cat > package.json << EOF
{
  "name": "$FULL_TEMPLATE_ID",
  "version": "1.0.0",
  "description": "{{PROJECT_DESCRIPTION}}",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "mcpresso": "^0.7.7",
    "zod": "^3.23.8",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.21",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  },
  "keywords": [
    "mcp",
    "mcpresso",
    "express",
    "api"
  ],
  "author": "",
  "license": "MIT"
}
EOF

    # Create README.md
    cat > README.md << EOF
# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## Quick Start

1. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Set up environment variables**
   \`\`\`bash
   cp env.example .env
   # Edit .env with your configuration
   \`\`\`

3. **Start development server**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Build for production**
   \`\`\`bash
   npm run build
   npm start
   \`\`\`

## Features

- MCP server with Express.js
- TypeScript support
- Development and production builds
- Environment variable configuration

## Project Structure

\`\`\`
src/
├── server.ts          # Main server file
└── resources/         # MCP resources
    ├── schemas/       # Resource schemas
    │   └── Note.ts    # Note data model
    └── handlers/      # Resource handlers
        └── note.ts    # Note resource implementation
\`\`\`

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| PORT | Server port | No | 3000 |
| SERVER_URL | Base URL of your server | Yes | - |

## Development

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm run typecheck\` - Type check without building

## License

MIT
EOF

    # Create GITHUB_README.md (simplified for GitHub)
    cat > GITHUB_README.md << EOF
# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

## Quick Start

\`\`\`bash
npm install
cp env.example .env
npm run dev
\`\`\`

## Features

- MCP server with Express.js
- TypeScript support
- Production ready

## License

MIT
EOF

    # Create .env.example
    cat > env.example << EOF
# Server Configuration
PORT=3000
SERVER_URL=http://localhost:3000

# Add your custom environment variables below
EOF

    # Create .gitignore
    cat > .gitignore << EOF
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build output
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output/

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
EOF

    # Create LICENSE
    cat > LICENSE << EOF
MIT License

Copyright (c) 2024 Granular Software

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

    # Create tsconfig.json
    cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
EOF

    # Create src directory and files
    mkdir -p src/resources/schemas src/resources/handlers

    # Create server.ts
    cat > src/server.ts << EOF
import "dotenv/config";
import { createMCPServer } from "mcpresso";
import { noteResource } from "./resources/handlers/note.js";

// Resolve the canonical base URL of this server for both dev and production.
const BASE_URL = process.env.SERVER_URL || \`http://localhost:\${process.env.PORT || 3000}\`;

// Create the MCP server (Express version)
const expressApp = createMCPServer({
  name: "{{PROJECT_NAME}}",
  serverUrl: BASE_URL,
  resources: [noteResource],
  exposeTypes: true,
  serverMetadata: {
    name: "{{PROJECT_NAME}}",
    version: "1.0.0",
    description: "{{PROJECT_DESCRIPTION}}",
  },
});

// Export for Node.js
export default expressApp;

// Local development server
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = process.env.PORT || 3000;
  console.log("Starting mcpresso server on port " + port);
  console.log("MCP Inspector URL: http://localhost:" + port);
  
  expressApp.listen(port, () => {
    console.log("Server running on http://localhost:" + port);
  });
}
EOF

    # Create Note schema
    cat > src/resources/schemas/Note.ts << EOF
import { z } from "zod";

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: z.date(),
});

export type Note = z.infer<typeof NoteSchema>;
EOF

    # Create note resource handler
    cat > src/resources/handlers/note.ts << EOF
import { z } from "zod";
import { createResource } from "mcpresso";
import { NoteSchema, type Note } from "../schemas/Note.js";

// In-memory storage (replace with your database)
const notes: Note[] = [];

// Create the notes resource
export const noteResource = createResource({
  name: "note",
  schema: NoteSchema,
  uri_template: "notes/{id}",
  methods: {
    get: {
      handler: async ({ id }) => {
        return notes.find((note) => note.id === id);
      },
    },
    list: {
      handler: async () => {
        return notes;
      },
    },
    create: {
      handler: async (data) => {
        const newNote = {
          id: Math.random().toString(36).substr(2, 9),
          title: data.title || "",
          content: data.content || "",
          createdAt: new Date(),
        };
        notes.push(newNote);
        return newNote;
      },
    },
    update: {
      handler: async ({ id, ...data }) => {
        const index = notes.findIndex((note) => note.id === id);
        if (index === -1) {
          throw new Error("Note not found");
        }
        const updatedNote = { 
          ...notes[index], 
          ...data, 
        };
        notes[index] = updatedNote;
        return updatedNote;
      },
    },
    delete: {
      handler: async ({ id }) => {
        const index = notes.findIndex((note) => note.id === id);
        if (index === -1) {
          return { success: false };
        }
        notes.splice(index, 1);
        return { success: true };
      },
    },
    search: {
      description: "Search notes by title or content",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
      }),
      handler: async ({ query }) => {
        return notes.filter(
          (note) =>
            note.title.toLowerCase().includes(query.toLowerCase()) ||
            note.content.toLowerCase().includes(query.toLowerCase())
        );
      },
    },
  },
});
EOF

    print_success "Template files generated"
}

# Function to push template to GitHub
push_to_github() {
    print_status "Pushing template to GitHub..."
    
    local template_dir="$MAIN_REPO_PATH/apps/$FULL_TEMPLATE_ID"
    cd "$template_dir"
    
    # Initialize git if not already done
    if [ ! -d ".git" ]; then
        git init
        git add .
        git commit -m "Initial commit: $TEMPLATE_NAME template"
        git branch -M main
        git remote add origin "https://github.com/$GITHUB_REPO.git"
    fi
    
    # Ensure we're on the main branch
    git checkout main || git checkout -b main
    
    # Add all files and commit if there are changes
    if ! git diff-index --quiet HEAD --; then
        git add .
        git commit -m "Update: $TEMPLATE_NAME template"
    fi
    
    # Push to GitHub with retry logic
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if git push -u origin main; then
            print_success "Template pushed to GitHub"
            break
        else
            if [ $attempt -eq $max_attempts ]; then
                print_error "Failed to push to GitHub after $max_attempts attempts"
                exit 1
            fi
            print_warning "Push attempt $attempt failed, retrying..."
            sleep 2
            attempt=$((attempt + 1))
        fi
    done
}

# Function to verify GitHub repository
verify_github_repo() {
    print_status "Verifying GitHub repository..."
    
    # Wait a moment for GitHub to process the repository creation
    sleep 3
    
    # Check if repo exists and is accessible
    if gh repo view "$GITHUB_REPO" >/dev/null 2>&1; then
        print_success "GitHub repository verified: $GITHUB_REPO"
    else
        print_error "GitHub repository not accessible: $GITHUB_REPO"
        print_error "Please check the repository URL and try again"
        exit 1
    fi
}

# Function to set up subtree in main repository
setup_subtree() {
    print_status "Setting up subtree in main repository..."
    
    cd "$MAIN_REPO_PATH"
    
    verbose_log "Current directory: $(pwd)"
    
    # Clean up any untracked template directories that might cause issues
    if [ -d "template-docker-single-user" ]; then
        print_warning "Found untracked template-docker-single-user directory, removing it..."
        rm -rf "template-docker-single-user"
        verbose_log "Removed template-docker-single-user directory"
    fi
    
    # Remove existing directory if it exists
    if [ -d "apps/$FULL_TEMPLATE_ID" ]; then
        print_warning "Removing existing template directory..."
        rm -rf "apps/$FULL_TEMPLATE_ID"
        git add -A
        git commit -m "feat: remove local template directory to prepare for subtree" || true
        verbose_log "Removed existing template directory and committed changes"
    fi
    
    # Ensure we're in a clean state
    git status --porcelain | grep -q . && {
        print_warning "Working directory not clean, committing changes first..."
        git add -A
        git commit -m "chore: commit pending changes before adding subtree" || true
        verbose_log "Committed pending changes"
    }
    
    # Add subtree with better error handling
    print_status "Adding subtree for $FULL_TEMPLATE_ID..."
    verbose_log "Adding subtree from: https://github.com/$GITHUB_REPO.git"
    
    if git subtree add --prefix="apps/$FULL_TEMPLATE_ID" "https://github.com/$GITHUB_REPO.git" main --squash; then
        print_success "Subtree added to main repository"
        verbose_log "Subtree added successfully"
    else
        print_error "Failed to add subtree. Trying alternative approach..."
        
        # Alternative approach: clone and copy files
        print_status "Falling back to manual setup..."
        local temp_dir=$(mktemp -d)
        verbose_log "Using temporary directory: $temp_dir"
        
        git clone "https://github.com/$GITHUB_REPO.git" "$temp_dir"
        verbose_log "Cloned repository to temporary directory"
        
        # Create the apps directory if it doesn't exist
        mkdir -p "apps/$FULL_TEMPLATE_ID"
        
        # Copy all files except .git
        cp -r "$temp_dir"/* "apps/$FULL_TEMPLATE_ID/"
        rm -rf "$temp_dir"
        verbose_log "Copied template files to apps/$FULL_TEMPLATE_ID"
        
        # Add to git
        git add "apps/$FULL_TEMPLATE_ID"
        git commit -m "feat: add $FULL_TEMPLATE_ID template manually"
        
        print_success "Template added manually to main repository"
        verbose_log "Template added manually and committed"
    fi
}

# Function to update CLI template manager
update_cli_template_manager() {
    print_status "Updating CLI template manager..."
    
    local template_manager_file="$MCPRESSO_PATH/src/cli/utils/template-manager.ts"
    
    # Check if template manager file exists
    if [ ! -f "$template_manager_file" ]; then
        print_warning "Template manager file not found: $template_manager_file"
        print_warning "Skipping CLI template manager update"
        return 0
    fi
    
    # Create backup
    cp "$template_manager_file" "$template_manager_file.backup"
    
    # Add new template to OFFICIAL_TEMPLATES array
    local template_entry="  {
    id: '$FULL_TEMPLATE_ID',
    name: '$TEMPLATE_NAME',
    description: '$TEMPLATE_DESCRIPTION',
    category: '$TEMPLATE_CATEGORY',
    authType: '$TEMPLATE_AUTH_TYPE',
    complexity: '$TEMPLATE_COMPLEXITY',
    url: 'https://github.com/$GITHUB_REPO',
    features: [
      'MCP server',
      'TypeScript',
      'Production ready'
    ],
    requirements: [
      'Node.js 18+',
      'npm or yarn'
    ],
    envVars: [
      { name: 'PORT', description: 'Server port', required: false, default: '3000' },
      { name: 'SERVER_URL', description: 'Base URL of your server', required: true }
    ]
  }"
    
    # Find the position to insert (before the closing bracket of OFFICIAL_TEMPLATES array)
    local insert_line=$(grep -n "];" "$template_manager_file" | head -1 | cut -d: -f1)
    
    if [ -z "$insert_line" ]; then
        print_error "Could not find OFFICIAL_TEMPLATES array in template manager file"
        print_warning "Restoring backup and skipping CLI update"
        cp "$template_manager_file.backup" "$template_manager_file"
        return 1
    fi
    
    # Create a temporary file with the new template entry
    local temp_file=$(mktemp)
    head -n $((insert_line - 1)) "$template_manager_file" > "$temp_file"
    echo "$template_entry" >> "$temp_file"
    tail -n +$insert_line "$template_manager_file" >> "$temp_file"
    
    # Replace the original file
    mv "$temp_file" "$template_manager_file"
    
    print_success "CLI template manager updated"
}

# Function to build and test CLI
build_and_test_cli() {
    print_status "Building and testing CLI..."
    
    cd "$MCPRESSO_PATH"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_warning "mcpresso package.json not found, skipping build"
        return 0
    fi
    
    # Check if build script exists
    if ! grep -q '"build"' package.json; then
        print_warning "No build script found in package.json, skipping build"
        return 0
    fi
    
    # Try to build
    if npm run build; then
        print_success "CLI build successful"
        
        # Test the CLI if dist directory exists
        if [ -d "dist" ] && [ -f "dist/cli/index.js" ]; then
            if node dist/cli/index.js list | grep -q "$TEMPLATE_NAME"; then
                print_success "Template is listed in CLI"
            else
                print_warning "Template might not appear in list immediately"
            fi
        else
            print_warning "CLI build output not found, skipping CLI test"
        fi
    else
        print_warning "CLI build failed, but continuing with template creation"
        print_warning "You may need to build the CLI manually later"
    fi
}

# Function to commit changes
commit_changes() {
    print_status "Committing changes to main repository..."
    
    cd "$MAIN_REPO_PATH"
    
    # Check if there are changes to commit
    if git diff-index --quiet HEAD --; then
        print_warning "No changes to commit"
        return 0
    fi
    
    git add .
    if git commit -m "feat: add $FULL_TEMPLATE_ID template subtree and update CLI"; then
        print_success "Changes committed"
        
        # Try to push to origin
        if git push origin main; then
            print_success "Changes pushed to origin"
        else
            print_warning "Failed to push to origin, but changes are committed locally"
        fi
    else
        print_error "Failed to commit changes"
        return 1
    fi
}

# Function to push subtree changes
push_subtree_changes() {
    print_status "Pushing subtree changes to template repository..."
    
    cd "$MAIN_REPO_PATH"
    
    # Check if the template directory exists
    if [ ! -d "apps/$FULL_TEMPLATE_ID" ]; then
        print_error "Template directory not found: apps/$FULL_TEMPLATE_ID"
        return 1
    fi
    
    # Try to push subtree changes
    if git subtree push --prefix="apps/$FULL_TEMPLATE_ID" "https://github.com/$GITHUB_REPO.git" main; then
        print_success "Subtree changes pushed to template repository"
    else
        print_warning "Failed to push subtree changes"
        print_warning "You may need to push manually later with:"
        echo "  git subtree push --prefix=apps/$FULL_TEMPLATE_ID https://github.com/$GITHUB_REPO.git main"
    fi
}

# Function to clean up a template
cleanup_template() {
    local template_id="$1"
    local full_id="${TEMPLATE_PREFIX}${template_id}"
    
    print_status "Cleaning up template: $full_id"
    
    # Check if template exists
    if [ ! -d "apps/$full_id" ]; then
        print_error "Template directory not found: apps/$full_id"
        return 1
    fi
    
    # Get GitHub repository URL
    local github_repo=""
    if [ -d "apps/$full_id/.git" ]; then
        github_repo=$(cd "apps/$full_id" && git remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's/.*github\.com[:/]//')
    fi
    
    echo "This will remove:"
    echo "  📁 Local directory: apps/$full_id/"
    echo "  🔗 Git subtree from main repository"
    if [ -n "$github_repo" ]; then
        echo "  🐙 GitHub repository: $github_repo"
    fi
    echo ""
    
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Cleanup cancelled"
        return 0
    fi
    
    # Remove from git subtree
    if [ -n "$github_repo" ]; then
        print_status "Removing git subtree..."
        git subtree remove --prefix="apps/$full_id" "$github_repo" main --squash
    fi
    
    # Remove local directory
    if [ -d "apps/$full_id" ]; then
        rm -rf "apps/$full_id"
        print_success "Local template directory removed"
    fi
    
    # Commit changes
    git add -A
    git commit -m "chore: remove template $full_id" || true
    
    print_success "Template cleanup completed"
    
    # Ask if user wants to delete GitHub repository
    if [ -n "$github_repo" ]; then
        echo ""
        read -p "Do you want to delete the GitHub repository $github_repo? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deleting GitHub repository..."
            gh repo delete "$github_repo" --yes
            print_success "GitHub repository deleted"
        fi
    fi
}

# Function to repair a broken template
repair_template() {
    local template_id="$1"
    local full_id="${TEMPLATE_PREFIX}${template_id}"
    
    print_status "Repairing template: $full_id"
    echo ""
    
    # Check if template directory exists
    if [ ! -d "apps/$full_id" ]; then
        print_error "Template directory not found: apps/$full_id"
        return 1
    fi
    
    echo "This will attempt to repair the template by:"
    echo "  1. Checking git subtree status"
    echo "  2. Re-establishing subtree if needed"
    echo "  3. Updating CLI integration"
    echo ""
    
    read -p "Continue with repair? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Repair cancelled"
        return 0
    fi
    
    # Check if it's a proper subtree
    if ! git log --grep="Squashed.*$full_id" >/dev/null 2>&1; then
        print_warning "Template is not a proper git subtree, attempting to fix..."
        
        # Get GitHub repository URL
        local github_repo=""
        if [ -d "apps/$full_id/.git" ]; then
            github_repo=$(cd "apps/$full_id" && git remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's/.*github\.com[:/]//')
        fi
        
        if [ -n "$github_repo" ]; then
            print_status "Re-establishing git subtree..."
            
            # Remove the directory
            rm -rf "apps/$full_id"
            git add -A
            git commit -m "chore: remove broken template directory to prepare for subtree repair" || true
            
            # Add subtree
            if git subtree add --prefix="apps/$full_id" "https://github.com/$github_repo.git" main --squash; then
                print_success "Git subtree re-established"
            else
                print_error "Failed to re-establish subtree"
                return 1
            fi
        else
            print_error "Cannot determine GitHub repository URL"
            return 1
        fi
    else
        print_success "Template is already a proper git subtree"
    fi
    
    # Update CLI integration
    print_status "Updating CLI integration..."
    update_cli_template_manager
    
    print_success "Template repair completed"
}

# Function to clean up git state
cleanup_git_state() {
    print_status "Cleaning up git state..."
    
    cd "$MAIN_REPO_PATH"
    
    # Show current git state
    show_git_state_summary
    
    # Remove any untracked template directories that might cause issues
    for dir in template-*; do
        if [ -d "$dir" ] && [ ! -d "$dir/.git" ]; then
            print_warning "Found untracked template directory: $dir, removing it..."
            rm -rf "$dir"
        fi
    done
    
    # Check if working directory is clean
    if ! git diff-index --quiet HEAD --; then
        print_warning "Working directory has uncommitted changes"
        echo "Current git status:"
        git status --porcelain | head -10
        
        if [ "$SKIP_CONFIRM" = false ]; then
            read -p "Do you want to commit these changes before proceeding? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git add -A
                git commit -m "chore: commit pending changes before template creation"
            else
                print_error "Please commit or stash your changes before proceeding"
                echo "You can use:"
                echo "  git add -A && git commit -m 'your message'"
                echo "  or"
                echo "  git stash"
                exit 1
            fi
        else
            print_status "Auto-committing changes due to --yes flag"
            git add -A
            git commit -m "chore: commit pending changes before template creation"
        fi
    fi
    
    # Check if we're on the main branch
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        print_warning "You're not on the main branch (currently on: $current_branch)"
        if [ "$SKIP_CONFIRM" = false ]; then
            read -p "Do you want to switch to main branch? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git checkout main
            else
                print_error "Please switch to main branch before proceeding"
                exit 1
            fi
        else
            print_status "Auto-switching to main branch due to --yes flag"
            git checkout main
        fi
    fi
    
    # Check if we're up to date with origin
    git fetch origin
    local behind_count=$(git rev-list --count HEAD..origin/main)
    if [ "$behind_count" -gt 0 ]; then
        print_warning "Your local branch is $behind_count commits behind origin/main"
        if [ "$SKIP_CONFIRM" = false ]; then
            read -p "Do you want to pull latest changes? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git pull origin main
            else
                print_error "Please pull latest changes before proceeding"
                exit 1
            fi
        else
            print_status "Auto-pulling latest changes due to --yes flag"
            git pull origin main
        fi
    fi
    
    print_success "Git state cleaned up"
}

# Function to show git state summary
show_git_state_summary() {
    echo ""
    print_status "📊 Git State Summary"
    echo "====================="
    echo ""
    
    # Current branch
    local current_branch=$(git branch --show-current)
    echo "🌿 Current Branch: $current_branch"
    
    # Working directory status
    if git diff-index --quiet HEAD --; then
        echo "📁 Working Directory: ✅ Clean"
    else
        echo "📁 Working Directory: ⚠️  Has uncommitted changes"
        echo "   Changes:"
        git status --porcelain | head -5 | sed 's/^/     /'
        if [ $(git status --porcelain | wc -l) -gt 5 ]; then
            echo "     ... and $(($(git status --porcelain | wc -l) - 5)) more"
        fi
    fi
    
    # Staged changes
    if git diff --cached --quiet; then
        echo "📦 Staged Changes: ✅ None"
    else
        echo "📦 Staged Changes: ⚠️  Has staged changes"
    fi
    
    # Remote status
    git fetch origin >/dev/null 2>&1
    local behind_count=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
    local ahead_count=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
    
    if [ "$behind_count" -eq 0 ] && [ "$ahead_count" -eq 0 ]; then
        echo "🔄 Remote Status: ✅ Up to date"
    elif [ "$behind_count" -gt 0 ]; then
        echo "🔄 Remote Status: ⚠️  $behind_count commits behind origin/main"
    elif [ "$ahead_count" -gt 0 ]; then
        echo "🔄 Remote Status: ⚠️  $ahead_count commits ahead of origin/main"
    fi
    
    # Untracked files
    local untracked_count=$(git ls-files --others --exclude-standard | wc -l)
    if [ "$untracked_count" -eq 0 ]; then
        echo "📄 Untracked Files: ✅ None"
    else
        echo "📄 Untracked Files: ⚠️  $untracked_count files"
        git ls-files --others --exclude-standard | head -3 | sed 's/^/     /'
        if [ "$untracked_count" -gt 3 ]; then
            echo "     ... and $(($untracked_count - 3)) more"
        fi
    fi
    
    echo ""
}

# Function to rollback changes on failure
rollback_changes() {
    local exit_code=$?
    
    print_error "Template creation failed, rolling back changes..."
    
    cd "$MAIN_REPO_PATH"
    
    # Remove the template directory if it exists
    if [ -d "apps/$FULL_TEMPLATE_ID" ]; then
        rm -rf "apps/$FULL_TEMPLATE_ID"
        git add -A
        git commit -m "chore: rollback failed template creation for $FULL_TEMPLATE_ID" || true
    fi
    
    # Restore CLI template manager backup if it exists
    local template_manager_file="$MCPRESSO_PATH/src/cli/utils/template-manager.ts"
    if [ -f "$template_manager_file.backup" ]; then
        cp "$template_manager_file.backup" "$template_manager_file"
        print_warning "CLI template manager restored from backup"
    fi
    
    print_warning "Rollback completed. You can try again or fix the issue manually."
    
    # Show error diagnosis
    diagnose_error $exit_code
}

# Function to provide error diagnosis
diagnose_error() {
    local error_code="$1"
    echo ""
    print_error "Error occurred during template creation (exit code: $error_code)"
    echo ""
    echo "Common issues and solutions:"
    echo ""
    
    case $error_code in
        1)
            echo "• Prerequisites not met: Check if gh, git, and node are installed"
            echo "• GitHub authentication: Run 'gh auth login' to authenticate"
            echo "• Repository permissions: Ensure you have access to $ORGANIZATION"
            ;;
        2)
            echo "• Template ID conflict: Choose a different template ID"
            echo "• GitHub repo exists: Delete the repository or use a different name"
            ;;
        3)
            echo "• Git state issues: Check git status and resolve conflicts"
            echo "• Branch issues: Ensure you're on the main branch"
            echo "• Remote issues: Check git remote configuration"
            ;;
        4)
            echo "• CLI build failure: Check mcpresso package dependencies"
            echo "• Template manager: Verify template-manager.ts file structure"
            ;;
        *)
            echo "• Unknown error: Check the error messages above"
            echo "• Git state: Run 'git status' to see current state"
            ;;
    esac
    
    echo ""
    echo "For detailed debugging, run the script with bash -x:"
    echo "  bash -x scripts/create-template.sh"
}

# Function to validate template configuration
validate_template_config() {
    print_status "Validating template configuration..."
    
    # Validate template ID format
    if [[ ! "$TEMPLATE_ID" =~ ^[a-z0-9-]+$ ]]; then
        print_error "Template ID must contain only lowercase letters, numbers, and hyphens"
        return 1
    fi
    
    # Validate category
    local valid_categories=("express" "docker" "cloud")
    if [[ ! " ${valid_categories[@]} " =~ " ${TEMPLATE_CATEGORY} " ]]; then
        print_error "Invalid category. Must be one of: ${valid_categories[*]}"
        return 1
    fi
    
    # Validate auth type
    local valid_auth_types=("oauth" "token" "none")
    if [[ ! " ${valid_auth_types[@]} " =~ " ${TEMPLATE_AUTH_TYPE} " ]]; then
        print_error "Invalid auth type. Must be one of: ${valid_auth_types[*]}"
        return 1
    fi
    
    # Validate complexity
    local valid_complexities=("easy" "medium" "hard")
    if [[ ! " ${valid_complexities[@]} " =~ " ${TEMPLATE_COMPLEXITY} " ]]; then
        print_error "Invalid complexity. Must be one of: ${valid_complexities[*]}"
        return 1
    fi
    
    print_success "Template configuration validated"
    return 0
}

# Function to provide recovery instructions
show_recovery_instructions() {
    echo ""
    print_warning "If you encounter issues, here are some recovery steps:"
    echo ""
    echo "1. Clean up any partial template directories:"
    echo "   rm -rf apps/$FULL_TEMPLATE_ID"
    echo ""
    echo "2. Remove any untracked template directories:"
    echo "   rm -rf template-*"
    echo ""
    echo "3. Reset git state if needed:"
    echo "   git reset --hard HEAD"
    echo "   git clean -fd"
    echo ""
    echo "4. Check git status:"
    echo "   git status"
    echo ""
    echo "5. If CLI template manager was modified, restore from backup:"
    echo "   cp $MCPRESSO_PATH/src/cli/utils/template-manager.ts.backup $MCPRESSO_PATH/src/cli/utils/template-manager.ts"
    echo ""
}

# Function to show creation summary
show_creation_summary() {
    echo ""
    print_status "Template Creation Summary:"
    echo "================================"
    echo ""
    echo "What will be created:"
    echo "  📁 Local directory: apps/$FULL_TEMPLATE_ID/"
    echo "  🐙 GitHub repository: $GITHUB_REPO"
    echo "  🔗 Git subtree in main repository"
    echo "  📝 CLI template manager update"
    echo "  🏗️  Template files and structure"
    echo ""
    echo "Template details:"
    echo "  • ID: $FULL_TEMPLATE_ID"
    echo "  • Name: $TEMPLATE_NAME"
    echo "  • Description: $TEMPLATE_DESCRIPTION"
    echo "  • Category: $TEMPLATE_CATEGORY"
    echo "  • Auth Type: $TEMPLATE_AUTH_TYPE"
    echo "  • Complexity: $TEMPLATE_COMPLEXITY"
    echo ""
    echo "Files that will be generated:"
    echo "  • package.json - Project configuration"
    echo "  • README.md - Project documentation"
    echo "  • GITHUB_README.md - GitHub-specific README"
    echo "  • .env.example - Environment variables template"
    echo "  • .gitignore - Git ignore rules"
    echo "  • LICENSE - MIT license"
    echo "  • tsconfig.json - TypeScript configuration"
    echo "  • src/server.ts - Main server file"
    echo "  • src/resources/schemas/Note.ts - Note data model"
    echo "  • src/resources/handlers/note.ts - Note resource handler"
    echo ""
    echo "Estimated time: 2-5 minutes"
    echo ""
}

# Function to handle user abort
handle_user_abort() {
    echo ""
    print_warning "Template creation aborted by user"
    echo ""
    echo "To clean up any partial changes:"
    echo "  1. Remove template directory: rm -rf apps/$FULL_TEMPLATE_ID"
    echo "  2. Remove GitHub repo: gh repo delete $GITHUB_REPO --yes"
    echo "  3. Reset git state if needed: git reset --hard HEAD"
    echo ""
    exit 1
}

# Function to show progress
show_progress() {
    local step="$1"
    local total_steps="$2"
    local description="$3"
    
    echo ""
    print_status "Step $step/$total_steps: $description"
    echo "----------------------------------------"
    
    # Show progress bar
    local progress=$((step * 100 / total_steps))
    local filled=$((progress / 2))
    local empty=$((50 - filled))
    
    printf "Progress: ["
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "] %d%%\n" $progress
    
    echo ""
}

# Function to verify final template creation
verify_final_template() {
    print_status "Verifying final template creation..."
    
    # Check if template directory exists
    if [ ! -d "apps/$FULL_TEMPLATE_ID" ]; then
        print_error "Template directory not found: apps/$FULL_TEMPLATE_ID"
        return 1
    fi
    
    # Check if key files exist
    local required_files=("package.json" "README.md" "src/server.ts")
    for file in "${required_files[@]}"; do
        if [ ! -f "apps/$FULL_TEMPLATE_ID/$file" ]; then
            print_error "Required file not found: $file"
            return 1
        fi
    done
    
    # Check if template is in CLI (if CLI was built)
    if [ -d "packages/mcpresso/dist" ] && [ -f "packages/mcpresso/dist/cli/index.js" ]; then
        if node packages/mcpresso/dist/cli/index.js list | grep -q "$TEMPLATE_NAME"; then
            print_success "Template is available in CLI"
        else
            print_warning "Template not yet visible in CLI (may need refresh)"
        fi
    fi
    
    print_success "Final template verification completed"
}

# Function to perform dry run
perform_dry_run() {
    print_status "Performing dry run..."
    echo ""
    echo "This would create:"
    echo "  📁 Directory: apps/$FULL_TEMPLATE_ID/"
    echo "  🐙 GitHub repo: $GITHUB_REPO"
    echo "  🔗 Git subtree in main repository"
    echo "  📝 CLI template manager update"
    echo ""
    echo "Template files that would be generated:"
    echo "  • package.json"
    echo "  • README.md"
    echo "  • GITHUB_README.md"
    echo "  • .env.example"
    echo "  • .gitignore"
    echo "  • LICENSE"
    echo "  • tsconfig.json"
    echo "  • src/server.ts"
    echo "  • src/resources/schemas/Note.ts"
    echo "  • src/resources/handlers/note.ts"
    echo ""
    echo "Dry run completed. No actual changes were made."
    exit 0
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Template Creation:"
    echo "  (no args)            Interactive template creation"
    echo "  -d, --dry-run        Perform a dry run (no actual changes)"
    echo "  -y, --yes            Skip confirmation prompts"
    echo "  -v, --verbose        Enable verbose output"
    echo ""
    echo "Template Management:"
    echo "  --list               List existing templates"
    echo "  --status <ID>        Check status of a specific template by ID"
    echo "  --repair <ID>        Repair a specific template by ID"
    echo "  --cleanup <ID>       Clean up a specific template by ID"
    echo ""
    echo "Examples:"
    echo "  $0                    # Interactive mode"
    echo "  $0 --dry-run         # Dry run mode"
    echo "  $0 --yes             # Skip confirmations"
    echo "  $0 --list            # List existing templates"
    echo "  $0 --status express-jwt-memory  # Check template status"
    echo "  $0 --repair express-jwt-memory  # Repair broken template"
    echo "  $0 --cleanup express-jwt-memory # Remove template"
    echo ""
    echo "This script creates and manages mcpresso templates."
    echo "Use --help to see this message again."
}

# Function to parse command line arguments
parse_arguments() {
    DRY_RUN=false
    SKIP_CONFIRM=false
    VERBOSE=false
    CLEANUP_TEMPLATE=""
    LIST_TEMPLATES=false
    STATUS_TEMPLATE=""
    REPAIR_TEMPLATE=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -y|--yes)
                SKIP_CONFIRM=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --cleanup)
                if [[ -z "$2" || "$2" =~ ^- ]]; then
                    print_error "--cleanup requires a template ID"
                    show_usage
                    exit 1
                fi
                CLEANUP_TEMPLATE="$2"
                shift 2
                ;;
            --list)
                LIST_TEMPLATES=true
                shift
                ;;
            --status)
                if [[ -z "$2" || "$2" =~ ^- ]]; then
                    print_error "--status requires a template ID"
                    show_usage
                    exit 1
                fi
                STATUS_TEMPLATE="$2"
                shift 2
                ;;
            --repair)
                if [[ -z "$2" || "$2" =~ ^- ]]; then
                    print_error "--repair requires a template ID"
                    show_usage
                    exit 1
                fi
                REPAIR_TEMPLATE="$2"
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Function to show final summary
show_final_summary() {
    echo ""
    print_success "🎉 Template Creation Summary"
    echo "================================="
    echo ""
    echo "✅ What was created:"
    echo "  📁 Local directory: apps/$FULL_TEMPLATE_ID/"
    echo "  🐙 GitHub repository: $GITHUB_REPO"
    echo "  🔗 Git subtree in main repository"
    echo "  📝 CLI template manager updated"
    echo "  🏗️  Template files and structure"
    echo ""
    echo "📋 Template details:"
    echo "  • ID: $FULL_TEMPLATE_ID"
    echo "  • Name: $TEMPLATE_NAME"
    echo "  • Description: $TEMPLATE_DESCRIPTION"
    echo "  • Category: $TEMPLATE_CATEGORY"
    echo "  • Auth Type: $TEMPLATE_AUTH_TYPE"
    echo "  • Complexity: $TEMPLATE_COMPLEXITY"
    echo ""
    echo "🚀 Next steps:"
    echo "  1. Test the template: mcpresso init test-project --template $FULL_TEMPLATE_ID --yes"
    echo "  2. Customize the template files in apps/$FULL_TEMPLATE_ID/"
    echo "  3. Push updates: git subtree push --prefix=apps/$FULL_TEMPLATE_ID https://github.com/$GITHUB_REPO.git main"
    echo ""
    echo "🔧 Maintenance:"
    echo "  • To update the template: git subtree push --prefix=apps/$FULL_TEMPLATE_ID https://github.com/$GITHUB_REPO.git main"
    echo "  • To pull updates: git subtree pull --prefix=apps/$FULL_TEMPLATE_ID https://github.com/$GITHUB_REPO.git main --squash"
    echo ""
    echo "📁 Template structure:"
    echo "  apps/$FULL_TEMPLATE_ID/"
    echo "  ├── package.json"
    echo "  ├── README.md"
    echo "  ├── GITHUB_README.md"
    echo "  ├── .env.example"
    echo "  ├── .gitignore"
    echo "  ├── LICENSE"
    echo "  ├── tsconfig.json"
    echo "  └── src/"
    echo "      ├── server.ts"
    echo "      └── resources/"
    echo "          ├── schemas/Note.ts"
    echo "          └── handlers/note.ts"
    echo ""
    echo "Template is now available in the CLI!"
    echo ""
    echo "🎯 Quick test command:"
    echo "  mcpresso init test-project --template $FULL_TEMPLATE_ID --yes"
}

# Function to check script permissions
check_script_permissions() {
    print_status "Checking script permissions..."
    
    # Check if script is executable
    if [ ! -x "$0" ]; then
        print_warning "Script is not executable. Making it executable..."
        chmod +x "$0"
    fi
    
    # Check if we can write to the current directory
    if [ ! -w "$(pwd)" ]; then
        print_error "Cannot write to current directory: $(pwd)"
        exit 1
    fi
    
    print_success "Script permissions verified"
}

# Function to list existing templates
list_templates() {
    print_status "Listing existing templates..."
    echo ""
    
    local found_templates=false
    
    # Check for templates in apps directory
    for dir in apps/template-*; do
        if [ -d "$dir" ]; then
            found_templates=true
            local template_id=$(basename "$dir")
            local template_name=""
            local template_description=""
            
            # Try to get template name from package.json
            if [ -f "$dir/package.json" ]; then
                template_name=$(grep '"name"' "$dir/package.json" | head -1 | sed 's/.*"name": *"\([^"]*\)".*/\1/')
                template_description=$(grep '"description"' "$dir/package.json" | head -1 | sed 's/.*"description": *"\([^"]*\)".*/\1/')
            fi
            
            echo "📁 $template_id"
            if [ -n "$template_name" ]; then
                echo "   Name: $template_name"
            fi
            if [ -n "$template_description" ]; then
                echo "   Description: $template_description"
            fi
            echo ""
        fi
    done
    
    if [ "$found_templates" = false ]; then
        echo "No templates found in apps/ directory"
    fi
}

# Function to check template status
check_template_status() {
    local template_id="$1"
    local full_id="${TEMPLATE_PREFIX}${template_id}"
    
    print_status "Checking status of template: $full_id"
    echo ""
    
    # Check if template directory exists
    if [ ! -d "apps/$full_id" ]; then
        print_error "Template directory not found: apps/$full_id"
        return 1
    fi
    
    echo "📁 Local Status:"
    echo "  Directory: apps/$full_id/"
    echo "  Exists: ✅ Yes"
    
    # Check git status
    if [ -d "apps/$full_id/.git" ]; then
        echo "  Git repository: ✅ Yes"
        local remote_url=$(cd "apps/$full_id" && git remote get-url origin 2>/dev/null)
        if [ -n "$remote_url" ]; then
            echo "  Remote URL: $remote_url"
        fi
    else
        echo "  Git repository: ❌ No"
    fi
    
    # Check key files
    local required_files=("package.json" "README.md" "src/server.ts")
    echo ""
    echo "📋 Required Files:"
    for file in "${required_files[@]}"; do
        if [ -f "apps/$full_id/$file" ]; then
            echo "  $file: ✅ Yes"
        else
            echo "  $file: ❌ No"
        fi
    done
    
    # Check if it's a git subtree
    echo ""
    echo "🔗 Git Subtree Status:"
    if git log --grep="Squashed.*$full_id" >/dev/null 2>&1; then
        echo "  Subtree: ✅ Yes"
        local last_commit=$(git log --grep="Squashed.*$full_id" --oneline -1)
        if [ -n "$last_commit" ]; then
            echo "  Last subtree commit: $last_commit"
        fi
    else
        echo "  Subtree: ❌ No"
    fi
    
    # Check CLI integration
    echo ""
    echo "📝 CLI Integration:"
    if [ -d "packages/mcpresso/dist" ] && [ -f "packages/mcpresso/dist/cli/index.js" ]; then
        if node packages/mcpresso/dist/cli/index.js list | grep -q "$full_id"; then
            echo "  Available in CLI: ✅ Yes"
        else
            echo "  Available in CLI: ❌ No"
        fi
    else
        echo "  Available in CLI: ⚠️  CLI not built"
    fi
}

# Function to show quick start guide
show_quick_start() {
    echo ""
    print_status "🚀 Quick Start Guide"
    echo "====================="
    echo ""
    echo "This script helps you create and manage mcpresso templates."
    echo ""
    echo "📋 Common Commands:"
    echo "  • Create a template: $0"
    echo "  • List templates: $0 --list"
    echo "  • Check status: $0 --status <template-id>"
    echo "  • Repair template: $0 --repair <template-id>"
    echo "  • Remove template: $0 --cleanup <template-id>"
    echo ""
    echo "🔧 Template Creation Process:"
    echo "  1. Creates GitHub repository"
    echo "  2. Generates template files"
    echo "  3. Sets up git subtree"
    echo "  4. Updates CLI integration"
    echo ""
    echo "💡 Tips:"
    echo "  • Use --dry-run to see what would be created"
    echo "  • Use --yes to skip confirmations"
    echo "  • Use --verbose for detailed output"
    echo ""
    echo "📚 For more help: $0 --help"
    echo ""
}

# Function to show environment summary
show_environment_summary() {
    echo ""
    print_status "🔧 Environment Summary"
    echo "======================="
    echo ""
    
    # System information
    echo "💻 System:"
    echo "  OS: $(uname -s) $(uname -r)"
    echo "  Shell: $SHELL"
    echo "  Current Directory: $(pwd)"
    echo ""
    
    # Tool versions
    echo "🛠️  Tools:"
    if command_exists git; then
        echo "  Git: $(git --version)"
    else
        echo "  Git: ❌ Not installed"
    fi
    
    if command_exists gh; then
        echo "  GitHub CLI: $(gh --version | head -1)"
    else
        echo "  GitHub CLI: ❌ Not installed"
    fi
    
    if command_exists node; then
        echo "  Node.js: $(node --version)"
    else
        echo "  Node.js: ❌ Not installed"
    fi
    
    if command_exists npm; then
        echo "  npm: $(npm --version)"
    else
        echo "  npm: ❌ Not installed"
    fi
    echo ""
    
    # Repository information
    echo "📁 Repository:"
    if [ -f "package.json" ]; then
        local repo_name=$(grep '"name"' package.json | head -1 | sed 's/.*"name": *"\([^"]*\)".*/\1/')
        local repo_version=$(grep '"version"' package.json | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
        echo "  Name: $repo_name"
        echo "  Version: $repo_version"
    else
        echo "  package.json: ❌ Not found"
    fi
    
    if [ -d ".git" ]; then
        local remote_url=$(git remote get-url origin 2>/dev/null || echo "No remote")
        echo "  Git Remote: $remote_url"
    else
        echo "  Git: ❌ Not a git repository"
    fi
    echo ""
}

# Main function
main() {
    # Parse command line arguments
    parse_arguments "$@"
    
    # Handle cleanup if requested
    if [ -n "$CLEANUP_TEMPLATE" ]; then
        check_prerequisites
        check_script_environment
        cleanup_template "$CLEANUP_TEMPLATE"
        exit 0
    fi
    
    # Handle list if requested
    if [ "$LIST_TEMPLATES" = true ]; then
        list_templates
        exit 0
    fi
    
    # Handle status check if requested
    if [ -n "$STATUS_TEMPLATE" ]; then
        check_template_status "$STATUS_TEMPLATE"
        exit 0
    fi
    
    # Handle repair if requested
    if [ -n "$REPAIR_TEMPLATE" ]; then
        check_prerequisites
        check_script_environment
        repair_template "$REPAIR_TEMPLATE"
        exit 0
    fi
    
    echo -e "${BLUE}🚀 mcpresso Template Creation Script${NC}"
    echo "=========================================="
    echo ""
    
    # Set up error handling
    set -e
    trap 'rollback_changes' ERR
    
    # Check prerequisites
    check_prerequisites
    
    # Check script permissions
    check_script_permissions
    
    # Check script environment
    check_script_environment
    
    # Show environment summary
    show_environment_summary
    
    # Clean up git state
    cleanup_git_state
    
    # Get template configuration
    get_template_config
    
    # Validate template configuration
    if ! validate_template_config; then
        print_error "Template configuration validation failed"
        exit 1
    fi
    
    echo ""
    echo "Template Configuration:"
    echo "  ID: $FULL_TEMPLATE_ID"
    echo "  Name: $TEMPLATE_NAME"
    echo "  Description: $TEMPLATE_DESCRIPTION"
    echo "  Category: $TEMPLATE_CATEGORY"
    echo "  Auth Type: $TEMPLATE_AUTH_TYPE"
    echo "  Complexity: $TEMPLATE_COMPLEXITY"
    echo "  GitHub Repo: $GITHUB_REPO"
    echo ""
    
    # Show recovery instructions
    show_recovery_instructions
    
    # Show creation summary
    show_creation_summary
    
    # Handle dry run
    if [ "$DRY_RUN" = true ]; then
        perform_dry_run
    fi
    
    # Handle confirmation
    if [ "$SKIP_CONFIRM" = false ]; then
        echo "Options:"
        echo "  [y] - Continue with template creation"
        echo "  [n] - Cancel template creation"
        echo "  [d] - Perform dry run (no actual changes)"
        echo ""
        
        read -p "Choose an option (y/N/d): " -n 1 -r
        echo
        case $REPLY in
            [Yy])
                # Continue with creation
                ;;
            [Dd])
                perform_dry_run
                ;;
            *)
                handle_user_abort
                ;;
        esac
    fi
    
    # Execute template creation steps
    local start_time=$(date '+%H:%M:%S')
    echo "⏰ Started at: $start_time"
    echo ""
    
    show_progress 1 9 "Creating GitHub repository"
    create_github_repo
    
    show_progress 2 9 "Generating template files"
    generate_template_files
    
    show_progress 3 9 "Pushing template to GitHub"
    push_to_github
    
    show_progress 4 9 "Verifying GitHub repository"
    verify_github_repo
    
    show_progress 5 9 "Setting up git subtree"
    setup_subtree
    
    show_progress 6 9 "Updating CLI template manager"
    update_cli_template_manager
    
    show_progress 7 9 "Building and testing CLI"
    build_and_test_cli
    
    show_progress 8 9 "Committing changes"
    commit_changes
    
    show_progress 9 9 "Pushing subtree changes"
    push_subtree_changes
    
    # Final verification
    verify_final_template
    
    # Clear error trap on success
    trap - ERR
    
    # Show completion time
    local end_time=$(date '+%H:%M:%S')
    
    echo ""
    print_success "Template creation completed successfully!"
    echo "⏰ Started at: $start_time"
    echo "⏰ Completed at: $end_time"
    echo ""
    show_final_summary
}

# Run main function
main "$@" 