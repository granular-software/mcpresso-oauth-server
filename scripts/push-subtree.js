#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const projects = {
  'mcpresso': {
    name: 'mcpresso',
    path: 'packages/mcpresso',
    subtreeRemote: 'git@github.com:granular-software/mcpresso.git',
    pushScript: 'push:mcpresso',
    description: 'TypeScript library for building MCP servers'
  },
  'mcpresso-oauth-server': {
    name: 'mcpresso-oauth-server', 
    path: 'packages/mcpresso-oauth-server',
    subtreeRemote: 'git@github.com:granular-software/mcpresso-oauth-server.git',
    pushScript: 'push:mcpresso-oauth-server',
    description: 'OAuth 2.1 server for MCP authentication'
  },
  'mcpresso-openapi-generator': {
    name: 'mcpresso-openapi-generator',
    path: 'packages/mcpresso-openapi-generator', 
    subtreeRemote: 'git@github.com:granular-software/mcpresso-openapi-generator.git',
    pushScript: 'push:mcpresso-openapi-generator',
    description: 'CLI tool to generate MCP servers from OpenAPI specs'
  },
  // Templates
  'template-docker-oauth-postgresql': {
    name: 'template-docker-oauth-postgresql',
    path: 'apps/template-docker-oauth-postgresql',
    subtreeRemote: 'git@github.com:granular-software/template-docker-oauth-postgresql.git',
    pushScript: 'push:template-docker-oauth-postgresql',
    description: 'Docker + OAuth2.1 + PostgreSQL template'
  },
  'template-express-oauth-sqlite': {
    name: 'template-express-oauth-sqlite',
    path: 'apps/template-express-oauth-sqlite',
    subtreeRemote: 'git@github.com:granular-software/template-express-oauth-sqlite.git',
    pushScript: 'push:template-express-oauth-sqlite',
    description: 'Express + OAuth2.1 + SQLite template'
  },
  'template-express-no-auth': {
    name: 'template-express-no-auth',
    path: 'apps/template-express-no-auth',
    subtreeRemote: 'git@github.com:granular-software/template-express-no-auth.git',
    pushScript: 'push:template-express-no-auth',
    description: 'Express + No Authentication template'
  }
};

function execCommand(command, cwd = process.cwd()) {
  try {
    return execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

function pushSubtree(projectName) {
  const project = projects[projectName];
  if (!project) {
    throw new Error(`Unknown project: ${projectName}`);
  }

  console.log(`🚀 Pushing ${project.name} to subtree...`);

  try {
    // First try normal push
    console.log(`📤 Attempting normal push to ${project.subtreeRemote}...`);
    execCommand(`git subtree push --prefix=${project.path} ${project.subtreeRemote} main`);
    console.log(`✅ Successfully pushed ${project.name} to subtree`);
    return true;
  } catch (error) {
    console.log(`⚠️  Normal push failed: ${error.message}`);
    
    // If normal push fails, try force push approach
    try {
      console.log(`🔄 Attempting force push approach...`);
      
      // Create a temporary branch for the subtree
      const tempBranch = `temp-subtree-${project.name}-${Date.now()}`;
      
      // Split the subtree to a new branch
      execCommand(`git subtree split --prefix=${project.path} --branch=${tempBranch}`);
      
      // Push the split branch to the remote
      execCommand(`git push ${project.subtreeRemote} ${tempBranch}:main --force`);
      
      // Clean up the temporary branch
      execCommand(`git branch -D ${tempBranch}`);
      
      console.log(`✅ Successfully force pushed ${project.name} to subtree`);
      return true;
    } catch (forceError) {
      console.log(`❌ Force push also failed: ${forceError.message}`);
      
      // Try one more approach - push to a new branch and provide instructions
      try {
        console.log(`🔄 Trying alternative approach with new branch...`);
        const newBranch = `clean-${project.name}-${Date.now()}`;
        
        // Split to new branch
        execCommand(`git subtree split --prefix=${project.path} --branch=${newBranch}`);
        
        // Push to new branch
        execCommand(`git push ${project.subtreeRemote} ${newBranch}:${newBranch}`);
        
        // Clean up
        execCommand(`git branch -D ${newBranch}`);
        
        console.log(`✅ Pushed ${project.name} to new branch: ${newBranch}`);
        console.log(`📝 Manual steps required:`);
        console.log(`   1. Go to ${project.subtreeRemote.replace('git@github.com:', 'https://github.com/').replace('.git', '')}`);
        console.log(`   2. Create a PR to merge ${newBranch} into main`);
        console.log(`   3. Or force push manually if you have admin access`);
        
        return true;
      } catch (finalError) {
        throw new Error(`All push attempts failed for ${project.name}:\n${error.message}\n${forceError.message}\n${finalError.message}`);
      }
    }
  }
}

// Main execution
if (require.main === module) {
  const projectName = process.argv[2];
  
  if (!projectName) {
    console.error('❌ Please provide a project name');
    console.log('Available projects:');
    Object.keys(projects).forEach(name => {
      console.log(`  • ${name} - ${projects[name].description}`);
    });
    process.exit(1);
  }

  try {
    const success = pushSubtree(projectName);
    if (success) {
      console.log(`🎉 Successfully pushed ${projectName} to subtree`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`❌ Failed to push ${projectName}:`, error.message);
    process.exit(1);
  }
}

module.exports = { pushSubtree, projects }; 