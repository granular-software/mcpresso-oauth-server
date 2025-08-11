import { PlopTypes } from "@turbo/gen";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

async function getComponents(basePath: string = "apps/awmt-os-core/components"): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(basePath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => {
        // Priority components (starting with _) first
        if (a.startsWith('_') && !b.startsWith('_')) return -1;
        if (!a.startsWith('_') && b.startsWith('_')) return 1;
        return a.localeCompare(b);
      });
  } catch {
    return [];
  }
}

async function getInterfaces(component: string, basePath: string = "apps/awmt-os-core/components"): Promise<string[]> {
  try {
    const interfacesPath = path.join(basePath, component, "interfaces");
    const files = await fs.promises.readdir(interfacesPath);
    return files
      .filter(file => file.endsWith('.ts'))
      .map(file => file.replace('.ts', ''))
      .sort();
  } catch {
    return [];
  }
}

async function getModels(component: string, basePath: string = "apps/awmt-os-core/components"): Promise<string[]> {
  try {
    const componentPath = path.join(basePath, component);
    const files = await fs.promises.readdir(componentPath);
    return files
      .filter(file => file.endsWith('.ts'))
      .map(file => file.replace('.ts', ''))
      .sort();
  } catch {
    return [];
  }
}

// Publishing helper functions
const projects = {
  'mcpresso': {
    name: 'mcpresso',
    path: 'packages/mcpresso',
    subtreeRemote: 'git@github.com:granular-software/mcpresso.git',
    pushScript: 'sync:mcpresso',
    description: 'TypeScript library for building MCP servers'
  },
  'mcpresso-oauth-server': {
    name: 'mcpresso-oauth-server', 
    path: 'packages/mcpresso-oauth-server',
    subtreeRemote: 'git@github.com:granular-software/mcpresso-oauth-server.git',
    pushScript: 'sync:mcpresso-oauth-server',
    description: 'OAuth 2.1 server for MCP authentication'
  },
  'mcpresso-openapi-generator': {
    name: 'mcpresso-openapi-generator',
    path: 'packages/mcpresso-openapi-generator', 
    subtreeRemote: 'git@github.com:granular-software/mcpresso-openapi-generator.git',
    pushScript: 'sync:mcpresso-openapi-generator',
    description: 'CLI tool to generate MCP servers from OpenAPI specs'
  }
};

// Template projects (GitHub only, no npm) - Dynamically discovered from apps/template-*
type TemplateDef = {
  name: string;
  path: string;
  subtreeRemote: string;
  description: string;
};

async function loadTemplatesFromDisk(): Promise<Record<string, TemplateDef>> {
  const baseDir = path.resolve("apps");
  const result: Record<string, TemplateDef> = {};
  try {
    const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith("template-")) continue;
      const dirName = entry.name;
      const templatePath = path.join("apps", dirName);
      const templateJsonPath = path.join(templatePath, "template.json");
      let description = dirName;
      try {
        const templateJson = JSON.parse(fs.readFileSync(templateJsonPath, "utf8"));
        if (typeof templateJson?.description === "string" && templateJson.description.trim()) {
          description = templateJson.description.trim();
        }
      } catch {}
      // Default subtree remote convention
      const subtreeRemote = `git@github.com:granular-software/${dirName}.git`;
      result[dirName] = {
        name: dirName,
        path: templatePath,
        subtreeRemote,
        description,
      };
    }
  } catch {
    // ignore
    console.log("No templates found in apps/template-*");
  }
  return result;
}

function getCurrentVersion(projectPath: string): string {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch {
    return "0.0.0";
  }
}

function bumpVersion(currentVersion: string, bumpType: string): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
}

function updateVersion(projectPath: string, newVersion: string): void {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

function execCommand(command: string, cwd?: string): string {
  try {
    return execSync(command, { 
      cwd: cwd || process.cwd(), 
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe']
    }).trim();
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // Component Generator
  plop.setGenerator("component", {
    description: "Create a new component with interfaces directory",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Component name:",
        validate: (input: string) => {
          if (!input.trim()) return "Component name is required";
          if (input.includes(" ")) return "Component name cannot include spaces";
          if (input.includes("/")) return "Component name cannot include slashes";
          return true;
        },
      },
    ],
    actions: [
      {
        type: "add",
        path: "apps/awmt-os-core/components/{{snakeCase name}}/interfaces/.gitkeep",
        template: "",
      },
      function (answers: any) {
        const fullPath = path.resolve("apps/awmt-os-core/components", answers.name);
        return `✅ Component '${answers.name}' created at: file://${fullPath}`;
      },
    ],
  });

  // Interface Generator
  plop.setGenerator("interface", {
    description: "Create a new interface with optional model implementations",
    prompts: [
      {
        type: "list",
        name: "component",
        message: "Select component:",
        choices: async () => {
          const components = await getComponents();
          if (components.length === 0) {
            return [{ name: "No components found - create one first", value: null }];
          }
          return [...components, { name: "Create new component", value: "__NEW__" }];
        },
      },
      {
        type: "input",
        name: "newComponent",
        message: "New component name:",
        when: (answers: any) => answers.component === "__NEW__",
        validate: (input: string) => {
          if (!input.trim()) return "Component name is required";
          return true;
        },
      },
      {
        type: "input",
        name: "name",
        message: "Interface name:",
        validate: (input: string) => {
          if (!input.trim()) return "Interface name is required";
          if (input.includes(" ")) return "Interface name cannot include spaces";
          return true;
        },
      },
      {
        type: "checkbox",
        name: "implementingModels",
        message: "Which existing models should implement this interface?",
        choices: async (answers: any) => {
          const component = answers.newComponent || answers.component;
          if (!component || component === "__NEW__") return [];
          const models = await getModels(component);
          return models.map(model => ({ name: model, value: model }));
        },
        when: async (answers: any) => {
          const component = answers.newComponent || answers.component;
          if (!component || component === "__NEW__") return false;
          const models = await getModels(component);
          return models.length > 0;
        },
      },
    ],
    actions: (data: any) => {
      if (!data) return [];
      
      const actions = [];
      const component = data.newComponent || data.component;
      
      if (!component) return [];
      
      // Create component if new
      if (data.newComponent) {
        actions.push({
          type: "add",
          path: "apps/awmt-os-core/components/{{snakeCase newComponent}}/interfaces/.gitkeep",
          template: "",
        });
      }
      
      // Create interface file
      actions.push({
        type: "add",
        path: `apps/awmt-os-core/components/${component}/interfaces/{{snakeCase name}}.ts`,
        templateFile: "templates/interface.hbs",
      });
      
      // Update implementing models
      if (data.implementingModels && data.implementingModels.length > 0) {
        data.implementingModels.forEach((model: string) => {
          // Add interface import
          actions.push({
            type: "modify",
            path: `apps/awmt-os-core/components/${component}/${model}.ts`,
            pattern: /(import CATEGORY from [^;]+;)/,
            template: `$1
import { {{pascalCase name}} } from "./interfaces/{{snakeCase name}}";`,
          });
          
          // Add interface implementation
          actions.push({
            type: "modify",
            path: `apps/awmt-os-core/components/${component}/${model}.ts`,
            pattern: /(export const (\w+) = native_model\.path\([^;]+;)/,
            template: `$1

$2.implement_interface({{pascalCase name}}).provide({
  _todo: (ant) =>
		Effect.gen(function* (_) {
			return true;
		}),
	_todo_mutation: (ant, value) =>
		Effect.gen(function* (_) {
			return false;
		}),
});`,
          });
        });
      }
      
      // Add success message with file link
      actions.push(function (answers: any) {
        const fullPath = path.resolve("apps/awmt-os-core/components", component, "interfaces", `${answers.name}.ts`);
        return `✅ Interface '${answers.name}' created at: file://${fullPath}`;
      });
      
      return actions;
    },
  });

  // Model Generator
  plop.setGenerator("model", {
    description: "Create a new model with optional interface implementations",
    prompts: [
      {
        type: "list",
        name: "component",
        message: "Select component:",
        choices: async () => {
          const components = await getComponents();
          if (components.length === 0) {
            return [{ name: "No components found - create one first", value: null }];
          }
          return [...components, { name: "Create new component", value: "__NEW__" }];
        },
      },
      {
        type: "input",
        name: "newComponent",
        message: "New component name:",
        when: (answers: any) => answers.component === "__NEW__",
        validate: (input: string) => {
          if (!input.trim()) return "Component name is required";
          return true;
        },
      },
      {
        type: "input",
        name: "name",
        message: "Model name:",
        validate: (input: string) => {
          if (!input.trim()) return "Model name is required";
          if (input.includes(" ")) return "Model name cannot include spaces";
          return true;
        },
      },
      {
        type: "checkbox",
        name: "interfaces",
        message: "Which interfaces should this model implement?",
        choices: async (answers: any) => {
          const component = answers.newComponent || answers.component;
          if (!component || component === "__NEW__") return [];
          const interfaces = await getInterfaces(component);
          return interfaces.map(iface => ({ name: iface, value: iface }));
        },
        when: async (answers: any) => {
          const component = answers.newComponent || answers.component;
          if (!component || component === "__NEW__") return false;
          const interfaces = await getInterfaces(component);
          return interfaces.length > 0;
        },
      },
    ],
    actions: (data: any) => {
      if (!data) return [];
      
      const actions = [];
      const component = data.newComponent || data.component;
      
      if (!component) return [];
      
      // Create component if new
      if (data.newComponent) {
        actions.push({
          type: "add",
          path: "apps/awmt-os-core/components/{{snakeCase newComponent}}/interfaces/.gitkeep",
          template: "",
        });
      }
      
      // Create model file
      actions.push({
        type: "add",
        path: `apps/awmt-os-core/components/${component}/{{snakeCase name}}.ts`,
        templateFile: "templates/model.hbs",
      });
      
      // Add success message with file link
      actions.push(function (answers: any) {
        const fullPath = path.resolve("apps/awmt-os-core/components", component, `${answers.name}.ts`);
        return `✅ Model '${answers.name}' created at: file://${fullPath}`;
      });
      
      return actions;
    },
  });

  // List Components Generator
  plop.setGenerator("list", {
    description: "List all components and their contents",
    prompts: [],
    actions: [
      async function () {
        const components = await getComponents();
        
        if (components.length === 0) {
          return "📦 No components found. Create your first component with: turbo gen component";
        }
        
        let output = "📦 Components Overview\n\n";
        
        for (const component of components) {
          const priority = component.startsWith('_') ? ' (Priority)' : '';
          const componentPath = path.resolve("apps/awmt-os-core/components", component);
          
          output += `📁 ${component}${priority}\n`;
          output += `   📂 file://${componentPath}\n`;
          
          const models = await getModels(component);
          if (models.length > 0) {
            output += `   📄 Models:\n`;
            models.forEach(model => {
              const modelPath = path.resolve("apps/awmt-os-core/components", component, `${model}.ts`);
              output += `      • ${model} - file://${modelPath}\n`;
            });
          }
          
          const interfaces = await getInterfaces(component);
          if (interfaces.length > 0) {
            output += `   🔌 Interfaces:\n`;
            interfaces.forEach(iface => {
              const interfacePath = path.resolve("apps/awmt-os-core/components", component, "interfaces", `${iface}.ts`);
              output += `      • ${iface} - file://${interfacePath}\n`;
            });
          }
          
          if (models.length === 0 && interfaces.length === 0) {
            output += `   (empty)\n`;
          }
          
          output += `\n`;
        }
        
        output += "🛠️ Available Commands:\n";
        output += "  • turbo gen component - Create a new component\n";
        output += "  • turbo gen model - Create a new model\n";
        output += "  • turbo gen interface - Create a new interface\n";
        output += "  • turbo gen list - Show this overview\n";
        
        return output;
      },
    ],
  });

  // Publish Generator
  plop.setGenerator("publish", {
    description: "Publish a package with version bump, commit, subtree push, and NPM publish",
    prompts: [
      {
        type: "list",
        name: "project",
        message: "📦 Which project do you want to publish?",
        choices: Object.values(projects).map(p => ({
          name: `${p.name} - ${p.description}`,
          value: p.name
        })),
      },
      {
        type: "list",
        name: "bumpType",
        message: (answers: any) => {
          const project = projects[answers.project as keyof typeof projects];
          const currentVersion = getCurrentVersion(project.path);
          return `📊 Current version: ${currentVersion}\n   What type of version bump?`;
        },
        choices: (answers: any) => {
          const project = projects[answers.project as keyof typeof projects];
          const currentVersion = getCurrentVersion(project.path);
          return [
            {
              name: `🔴 major (${bumpVersion(currentVersion, 'major')}) - Breaking changes`,
              value: 'major'
            },
            {
              name: `🟡 minor (${bumpVersion(currentVersion, 'minor')}) - New features`,
              value: 'minor'
            },
            {
              name: `🟢 patch (${bumpVersion(currentVersion, 'patch')}) - Bug fixes`,
              value: 'patch'
            }
          ];
        },
      },
      {
        type: "confirm",
        name: "confirmed",
        message: (answers: any) => {
          const project = projects[answers.project as keyof typeof projects];
          const currentVersion = getCurrentVersion(project.path);
          const newVersion = bumpVersion(currentVersion, answers.bumpType);
          return `🚀 Proceed with publishing ${answers.project} v${newVersion}?`;
        },
        default: false,
      },
    ],
    actions: (data: any) => {
      if (!data || !data.confirmed) {
        return [
          function () {
            return "❌ Publication cancelled by user.";
          }
        ];
      }

      const project = projects[data.project as keyof typeof projects];
      const currentVersion = getCurrentVersion(project.path);
      const newVersion = bumpVersion(currentVersion, data.bumpType);

      return [
        // Step 1: Check prerequisites
        function () {
          try {
            // Check git status
            const status = execCommand('git status --porcelain');
            if (status.length > 0) {
              throw new Error(`⚠️  You have uncommitted changes:\n${status}\nPlease commit or stash them first.`);
            }

            // Check NPM auth
            execCommand('npm whoami');
            
            return "✅ Prerequisites checked successfully";
          } catch (error) {
            throw new Error(`❌ Prerequisites check failed: ${error}`);
          }
        },

        // Step 2: Pre-sync subtree (pull-only) to avoid merge conflicts later
        function () {
          try {
            execCommand(`node scripts/sync-subtree.js ${project.name} --pull-only`);
            return `✅ Pre-synced ${project.name} (pull-only)`;
          } catch (error) {
            throw new Error(`❌ Failed to pre-sync subtree (pull-only): ${error}`);
          }
        },

        // Step 3: Update version
        function () {
          try {
            updateVersion(project.path, newVersion);
            return `✅ Updated ${project.path}/package.json to version ${newVersion}`;
          } catch (error) {
            throw new Error(`❌ Failed to update version: ${error}`);
          }
        },

        // Step 4: Commit changes
        function () {
          try {
            execCommand('git add -A');
            execCommand(`git commit -m "chore(${project.name}): bump version to ${newVersion}"`);
            return `✅ Version change committed to main repository`;
          } catch (error) {
            throw new Error(`❌ Failed to commit changes: ${error}`);
          }
        },

        // Step 5: Push to main repository
        function () {
          try {
            execCommand('git push origin main');
            return `✅ Pushed to main repository`;
          } catch (error) {
            throw new Error(`❌ Failed to push to main repository: ${error}`);
          }
        },

        // Step 6: Push to subtree (push-only, we've already pulled)
        function () {
          try {
            execCommand(`node scripts/sync-subtree.js ${project.name} --push-only`);
            return `✅ Pushed ${project.name} to ${project.subtreeRemote}`;
          } catch (error) {
            throw new Error(`❌ Failed to push to subtree: ${error}\n\n🚨 PUBLICATION STOPPED: Subtree push failed. Please fix the issue and try again.`);
          }
        },

        // Step 7: Build and publish to NPM
        function () {
          try {
            const projectDir = path.resolve(project.path);
            
            // Try to build
            try {
              execCommand('npm run build', projectDir);
            } catch {
              // Build might not exist, continue
            }

            // Publish to NPM
            execCommand('npm publish --access public', projectDir);
            
            return `✅ Published ${project.name}@${newVersion} to NPM`;
          } catch (error) {
            throw new Error(`❌ Failed to publish to NPM: ${error}\n\n🚨 PUBLICATION STOPPED: NPM publish failed. Please fix the issue and try again.`);
          }
        },

        // Step 8: Success summary
        function () {
          const githubUrl = project.subtreeRemote.replace('git@github.com:', 'https://github.com/').replace('.git', '');
          
          return `
🎉 Publication Complete!

📦 Package: ${project.name}
📊 Version: ${newVersion}
🌐 NPM: https://www.npmjs.com/package/${project.name}
🐙 GitHub: ${githubUrl}

🚀 Next steps:
• Update any dependent projects
• Update documentation if needed
• Announce the release
          `;
        },
      ];
    },
  });

  // Publish Template Generator
  plop.setGenerator("publish-template", {
    description: "Publish a template with version bump, commit, and subtree push (GitHub only, no NPM)",
    prompts: [
      {
        type: "list",
        name: "template",
        message: "📦 Which template do you want to publish?",
        choices: async () => {
          const templates = await loadTemplatesFromDisk();
          const values = Object.values(templates);
          if (values.length === 0) {
            return [{ name: "No templates found in apps/template-*", value: null }];
          }
          return values.map(t => ({ name: `${t.name} - ${t.description}`, value: t.name }));
        },
      },
      {
        type: "list",
        name: "bumpType",
        message: async (answers: any) => {
          const templates = await loadTemplatesFromDisk();
          const template = templates[answers.template as keyof typeof templates];
          const currentVersion = getCurrentVersion(template?.path || "");
          return `📊 Current version: ${currentVersion}\n   What type of version bump?`;
        },
        choices: async (answers: any) => {
          const templates = await loadTemplatesFromDisk();
          const template = templates[answers.template as keyof typeof templates];
          const currentVersion = getCurrentVersion(template?.path || "");
          return [
            {
              name: `🔴 major (${bumpVersion(currentVersion, 'major')}) - Breaking changes`,
              value: 'major'
            },
            {
              name: `🟡 minor (${bumpVersion(currentVersion, 'minor')}) - New features`,
              value: 'minor'
            },
            {
              name: `🟢 patch (${bumpVersion(currentVersion, 'patch')}) - Bug fixes`,
              value: 'patch'
            }
          ];
        },
      },
      {
        type: "confirm",
        name: "confirmed",
        message: async (answers: any) => {
          const templates = await loadTemplatesFromDisk();
          const template = templates[answers.template as keyof typeof templates];
          const currentVersion = getCurrentVersion(template?.path || "");
          const newVersion = bumpVersion(currentVersion, answers.bumpType);
          return `🚀 Proceed with publishing template ${answers.template} v${newVersion} to GitHub?`;
        },
        default: false,
      },
    ],
    actions: (data: any) => {
      if (!data || !data.confirmed) {
        return [
          function () {
            return "❌ Template publication cancelled by user.";
          }
        ];
      }

      let templateCache: Record<string, TemplateDef> | null = null;
      const getTemplate = async () => {
        if (!templateCache) templateCache = await loadTemplatesFromDisk();
        return templateCache[data.template as keyof typeof templateCache];
      };

      // We will resolve template at action time since actions can be functions executed later
      const currentVersion = "dynamic";
      const newVersion = bumpVersion(currentVersion, data.bumpType);

      return [
        // Step 1: Check prerequisites
        async function () {
          try {
            // Check git status
            const status = execCommand('git status --porcelain');
            if (status.length > 0) {
              throw new Error(`⚠️  You have uncommitted changes:\n${status}\nPlease commit or stash them first.`);
            }
            
            return "✅ Prerequisites checked successfully";
          } catch (error) {
            throw new Error(`❌ Prerequisites check failed: ${error}`);
          }
        },

        // Step 2: Pre-sync subtree (pull-only) to avoid merge conflicts later
        async function () {
          try {
            const t = await getTemplate();
            execCommand(`node scripts/sync-subtree.js ${t.name} --pull-only`);
            return `✅ Pre-synced ${t.name} (pull-only)`;
          } catch (error) {
            throw new Error(`❌ Failed to pre-sync template subtree (pull-only): ${error}`);
          }
        },

        // Step 3: Update version
        async function () {
          try {
            const t = await getTemplate();
            const current = getCurrentVersion(t.path);
            const newVersion = bumpVersion(current, (data as any).bumpType);
            updateVersion(t.path, newVersion);
            return `✅ Updated ${t.path}/package.json to version ${newVersion}`;
          } catch (error) {
            throw new Error(`❌ Failed to update version: ${error}`);
          }
        },

        // Step 4: Commit changes
        async function () {
          try {
            execCommand('git add -A');
            const t = await getTemplate();
            const current = getCurrentVersion(t.path);
            const newVersion = bumpVersion(current, (data as any).bumpType);
            execCommand(`git commit -m "chore(${t.name}): bump version to ${newVersion}"`);
            return `✅ Version change committed to main repository`;
          } catch (error) {
            throw new Error(`❌ Failed to commit changes: ${error}`);
          }
        },

        // Step 5: Push to main repository
        async function () {
          try {
            execCommand('git push origin main');
            return `✅ Pushed to main repository`;
          } catch (error) {
            throw new Error(`❌ Failed to push to main repository: ${error}`);
          }
        },

        // Step 6: Push to subtree (GitHub only, push-only)
        async function () {
          try {
            const t = await getTemplate();
            execCommand(`node scripts/sync-subtree.js ${t.name} --push-only`);
            return `✅ Pushed template ${t.name} to ${t.subtreeRemote}`;
          } catch (error) {
            throw new Error(`❌ Failed to push template to subtree: ${error}\n\n🚨 PUBLICATION STOPPED: Subtree push failed. Please fix the issue and try again.`);
          }
        },

        // Step 7: Success summary (GitHub only)
        async function () {
          const t = await getTemplate();
          const githubUrl = t.subtreeRemote.replace('git@github.com:', 'https://github.com/').replace('.git', '');
          
          return `
🎉 Template Publication Complete!

📦 Template: ${(t as any).name}
📊 Version: (bumped)
🐙 GitHub: ${githubUrl}

🚀 Next steps:
• Test the template: npx mcpresso init test-project --template ${(t as any).name}
• Update documentation if needed
• Announce the template update
          `;
        },
      ];
    },
  });
}
