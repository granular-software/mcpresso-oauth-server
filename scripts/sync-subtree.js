#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projects = {
  'mcpresso': {
    name: 'mcpresso',
    path: 'packages/mcpresso',
    subtreeRemote: 'git@github.com:granular-software/mcpresso.git',
    syncScript: 'sync:mcpresso',
    description: 'TypeScript library for building MCP servers'
  },
  'mcpresso-oauth-server': {
    name: 'mcpresso-oauth-server', 
    path: 'packages/mcpresso-oauth-server',
    subtreeRemote: 'git@github.com:granular-software/mcpresso-oauth-server.git',
    syncScript: 'sync:mcpresso-oauth-server',
    description: 'OAuth 2.1 server for MCP authentication'
  },
  'mcpresso-openapi-generator': {
    name: 'mcpresso-openapi-generator',
    path: 'packages/mcpresso-openapi-generator', 
    subtreeRemote: 'git@github.com:granular-software/mcpresso-openapi-generator.git',
    syncScript: 'sync:mcpresso-openapi-generator',
    description: 'CLI tool to generate MCP servers from OpenAPI specs'
  },
  // Templates
  'template-docker-oauth-postgresql': {
    name: 'template-docker-oauth-postgresql',
    path: 'apps/template-docker-oauth-postgresql',
    subtreeRemote: 'git@github.com:granular-software/template-docker-oauth-postgresql.git',
    syncScript: 'sync:template-docker-oauth-postgresql',
    description: 'Docker + OAuth2.1 + PostgreSQL template'
  },
  'template-express-oauth-sqlite': {
    name: 'template-express-oauth-sqlite',
    path: 'apps/template-express-oauth-sqlite',
    subtreeRemote: 'git@github.com:granular-software/template-express-oauth-sqlite.git',
    syncScript: 'sync:template-express-oauth-sqlite',
    description: 'Express + OAuth2.1 + SQLite template'
  },
  'template-express-no-auth': {
    name: 'template-express-no-auth',
    path: 'apps/template-express-no-auth',
    subtreeRemote: 'git@github.com:granular-software/template-express-no-auth.git',
    syncScript: 'sync:template-express-no-auth',
    description: 'Express + No Authentication template'
  }
};

// Dynamically discover additional templates under apps/template-*
function loadTemplatesToProjects() {
  try {
    const baseDir = path.resolve('apps');
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith('template-')) continue;
      const name = entry.name;
      if (projects[name]) continue; // already defined
      const templatePath = path.join('apps', name);
      // Try to read description from template.json
      let description = `${name} template`;
      try {
        const tplJson = JSON.parse(fs.readFileSync(path.join(templatePath, 'template.json'), 'utf8'));
        if (typeof tplJson?.description === 'string' && tplJson.description.trim()) {
          description = tplJson.description.trim();
        }
      } catch {}
      projects[name] = {
        name,
        path: templatePath,
        subtreeRemote: `git@github.com:granular-software/${name}.git`,
        syncScript: `sync:${name}`,
        description
      };
    }
  } catch (e) {
    // noop
  }
}
// Load dynamic templates at startup
loadTemplatesToProjects();

function execCommand(command, cwd = process.cwd(), throwOnError = true) {
  try {
    return execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    if (throwOnError) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
    return null;
  }
}

function checkWorkingTreeClean() {
  const status = execCommand('git status --porcelain', process.cwd(), false);
  if (status && status.trim()) {
    throw new Error(`Working tree is not clean. Please commit or stash your changes first:\n${status}`);
  }
}

function hasLocalChanges(project) {
  // Check if there are uncommitted changes in the subtree directory
  const uncommittedChanges = execCommand(`git status --porcelain ${project.path}`, process.cwd(), false);
  if (uncommittedChanges && uncommittedChanges.trim()) {
    console.log(`📝 Uncommitted changes found in ${project.name}:`);
    console.log(uncommittedChanges);
    return true;
  }

  // Check if there are commits to push by creating a temporary split
  const tempBranch = `temp-check-${project.name}-${Date.now()}`;
  
  try {
    // Add remote temporarily if not exists
    const remoteExists = execCommand(`git remote | grep temp-${project.name}`, process.cwd(), false);
    if (!remoteExists) {
      execCommand(`git remote add temp-${project.name} ${project.subtreeRemote}`);
    }
    
    // Fetch latest
    execCommand(`git fetch temp-${project.name}`);
    
    // Create split branch
    execCommand(`git subtree split --prefix=${project.path} -b ${tempBranch}`);
    
    // Check for commits to push
    const commitsToPush = execCommand(`git log ${tempBranch} ^temp-${project.name}/main --oneline`, process.cwd(), false);
    
    // Cleanup
    execCommand(`git branch -D ${tempBranch}`, process.cwd(), false);
    execCommand(`git remote remove temp-${project.name}`, process.cwd(), false);
    
    return commitsToPush && commitsToPush.trim().length > 0;
  } catch (error) {
    // Cleanup on error
    execCommand(`git branch -D ${tempBranch}`, process.cwd(), false);
    execCommand(`git remote remove temp-${project.name}`, process.cwd(), false);
    return false;
  }
}

function syncSubtree(projectName, options = {}) {
  const project = projects[projectName];
  if (!project) {
    throw new Error(`Unknown project: ${projectName}`);
  }

  const { pullOnly = false, pushOnly = false, force = false } = options;

  console.log(`🔄 Syncing ${project.name} subtree...`);

  // Check if working tree is clean
  if (!force) {
    checkWorkingTreeClean();
  }

  // Step 1: Always pull first (unless push-only mode)
  if (!pushOnly) {
    console.log(`📥 Pulling latest changes from ${project.subtreeRemote}...`);
    
    try {
      execCommand(`git subtree pull --prefix=${project.path} ${project.subtreeRemote} main --squash`);
      console.log(`✅ Successfully pulled latest changes for ${project.name}`);
    } catch (error) {
      const errorMessage = String(error.message || '');
      if (errorMessage.includes('merge conflict')) {
        console.log(`⚠️  Merge conflicts detected in ${project.name}`);
        console.log(`📝 Please resolve conflicts in ${project.path}/ and then run:`);
        console.log(`   git add ${project.path}/`);
        console.log(`   git commit -m "resolve: merge conflicts in ${project.name}"`);
        console.log(`   npm run sync:${projectName}`);
        throw new Error('Merge conflicts need to be resolved manually');
      } else if (errorMessage.includes("was never added")) {
        // Handle first-time setup where the subtree hasn't been added yet
        console.log(`⚠️  Subtree for ${project.name} was never added. Initializing now...`);
        try {
          // Try a straightforward add first
          execCommand(`git subtree add --prefix=${project.path} ${project.subtreeRemote} main --squash`);
          console.log(`✅ Subtree initialized for ${project.name}`);
        } catch (addError) {
          const addErrMsg = String(addError.message || '');
          if (addErrMsg.includes("prefix '")) {
            // The directory already exists locally. We'll safely back it up, clear it, and add the subtree
            const timestamp = Date.now();
            const backupPath = path.join(process.cwd(), `${project.path}.backup-${timestamp}`);
            console.log(`🗄️  Backing up existing directory to ${backupPath} ...`);
            // Best-effort backup; ignore failures
            execCommand(`mkdir -p ${path.dirname(backupPath)}`, process.cwd(), false);
            execCommand(`cp -R ${project.path} ${backupPath}`, process.cwd(), false);
            console.log(`🧹 Preparing prefix for subtree add...`);
            // Remove from index if tracked, and remove the working directory copy
            execCommand(`git rm -r --cached ${project.path}`, process.cwd(), false);
            execCommand(`rm -rf ${project.path}`, process.cwd(), false);
            // Commit the preparation if there are staged changes
            execCommand(`git commit -m "chore(subtree): prepare ${project.name} prefix for subtree add"`, process.cwd(), false);
            // Now add the subtree
            execCommand(`git subtree add --prefix=${project.path} ${project.subtreeRemote} main --squash`);
            console.log(`✅ Subtree initialized for ${project.name}`);
          } else {
            throw new Error(`Failed to initialize subtree for ${project.name}: ${addErrMsg}`);
          }
        }
        // After initialization, we consider pull successful and move on
        console.log(`✅ Pull completed for ${project.name}`);
      } else {
        // If pull fails for other reasons, continue but warn
        console.log(`⚠️  Pull failed: ${errorMessage}`);
        if (!force) {
          throw error;
        }
      }
    }
  }

  // Stop here if pull-only mode
  if (pullOnly) {
    console.log(`✅ Pull completed for ${project.name}`);
    return true;
  }

  // Step 2: Check if we have local changes to push
  if (!hasLocalChanges(project)) {
    console.log(`✅ ${project.name} is already up to date, no changes to push`);
    return true;
  }

  // Step 3: Push our changes
  console.log(`📤 Pushing local changes to ${project.subtreeRemote}...`);
  
  try {
    execCommand(`git subtree push --prefix=${project.path} ${project.subtreeRemote} main`);
    console.log(`✅ Successfully pushed ${project.name} to subtree`);
    return true;
  } catch (error) {
    console.log(`⚠️  Normal push failed: ${error.message}`);
    
    if (force) {
      console.log(`🔄 Force mode enabled, attempting force push...`);
      
      try {
        // Create a temporary branch for the subtree
        const tempBranch = `force-push-${project.name}-${Date.now()}`;
        
        // Split the subtree to a new branch
        execCommand(`git subtree split --prefix=${project.path} --branch=${tempBranch}`);
        
        // Force push the split branch to the remote
        execCommand(`git push ${project.subtreeRemote} ${tempBranch}:main --force`);
        
        // Clean up the temporary branch
        execCommand(`git branch -D ${tempBranch}`);
        
        console.log(`✅ Successfully force pushed ${project.name} to subtree`);
        console.log(`⚠️  WARNING: Force push overwrites remote history. Ensure this is intended.`);
        return true;
      } catch (forceError) {
        throw new Error(`Force push failed for ${project.name}: ${forceError.message}`);
      }
    } else {
      console.log(`❌ Push failed. This usually means someone else has pushed changes.`);
      console.log(`💡 Try running: npm run sync:${projectName} (to pull their changes first)`);
      console.log(`💡 Or use --force flag if you want to overwrite remote changes: node scripts/sync-subtree.js ${projectName} --force`);
      throw error;
    }
  }
}

function syncAll(options = {}) {
  console.log(`🔄 Syncing all subtrees...`);
  
  const results = [];
  
  for (const projectName of Object.keys(projects)) {
    try {
      console.log(`\n--- Syncing ${projectName} ---`);
      const success = syncSubtree(projectName, options);
      results.push({ project: projectName, success, error: null });
    } catch (error) {
      console.error(`❌ Failed to sync ${projectName}: ${error.message}`);
      results.push({ project: projectName, success: false, error: error.message });
    }
  }
  
  // Summary
  console.log(`\n📊 Sync Summary:`);
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log(`✅ Successfully synced: ${successful.map(r => r.project).join(', ')}`);
  }
  
  if (failed.length > 0) {
    console.log(`❌ Failed to sync: ${failed.map(r => r.project).join(', ')}`);
    failed.forEach(f => {
      console.log(`   ${f.project}: ${f.error}`);
    });
  }
  
  return failed.length === 0;
}

// Parse command line arguments
function parseArgs(args) {
  const options = {
    pullOnly: false,
    pushOnly: false,
    force: false,
    all: false
  };
  
  let projectName = null;
  
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--pull-only') {
      options.pullOnly = true;
    } else if (arg === '--push-only') {
      options.pushOnly = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/sync-subtree.js [PROJECT_NAME] [OPTIONS]

PROJECT_NAME: One of the available projects
OPTIONS:
  --all         Sync all projects
  --pull-only   Only pull changes, don't push
  --push-only   Only push changes, don't pull (NOT RECOMMENDED)
  --force       Force push even if it overwrites remote changes (DANGEROUS)
  --help, -h    Show this help message

Available projects:
${Object.keys(projects).map(name => `  • ${name} - ${projects[name].description}`).join('\n')}

Examples:
  node scripts/sync-subtree.js mcpresso                    # Safe sync mcpresso
  node scripts/sync-subtree.js mcpresso --pull-only       # Only pull mcpresso changes
  node scripts/sync-subtree.js --all                      # Sync all projects
  node scripts/sync-subtree.js mcpresso --force           # Force push (overwrites remote)

RECOMMENDED WORKFLOW:
1. npm run sync:PROJECT_NAME                             # Safe sync (pull + push)
2. If conflicts occur, resolve them manually and re-run
3. Only use --force if you're absolutely sure you want to overwrite remote changes
      `);
      process.exit(0);
    } else if (!projectName && !arg.startsWith('--')) {
      projectName = arg;
    }
  }
  
  return { projectName, options };
}

// Main execution
if (require.main === module) {
  const { projectName, options } = parseArgs(process.argv);
  
  if (options.all) {
    try {
      const success = syncAll(options);
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error(`❌ Failed to sync all projects:`, error.message);
      process.exit(1);
    }
  } else if (!projectName) {
    console.error('❌ Please provide a project name or use --all');
    console.log('Available projects:');
    Object.keys(projects).forEach(name => {
      console.log(`  • ${name} - ${projects[name].description}`);
    });
    console.log('\nUse --help for more options');
    process.exit(1);
  } else if (!projects[projectName]) {
    console.error(`❌ Unknown project: ${projectName}`);
    console.log('Available projects:');
    Object.keys(projects).forEach(name => {
      console.log(`  • ${name} - ${projects[name].description}`);
    });
    process.exit(1);
  }

  try {
    const success = syncSubtree(projectName, options);
    if (success) {
      console.log(`🎉 Successfully synced ${projectName}`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`❌ Failed to sync ${projectName}:`, error.message);
    process.exit(1);
  }
}

module.exports = { syncSubtree, syncAll, projects };