import { generateFromOpenAPI } from './dist/generator.js';
import fs from 'fs-extra';
import path from 'path';

async function testFix() {
  const testDir = './test-output';
  
  try {
    // Clean up previous test output
    await fs.remove(testDir);
    
    // Generate server from OpenAPI spec
    await generateFromOpenAPI({
      source: './openapi.json',
      outputDir: testDir,
      serverName: 'test-server',
      verbose: true
    });
    
    // Check if the ServersResource.ts file was generated and has the correct imports
    const serversResourcePath = path.join(testDir, 'resources', 'ServersResource.ts');
    
    if (await fs.pathExists(serversResourcePath)) {
      const content = await fs.readFile(serversResourcePath, 'utf-8');
      console.log('✅ ServersResource.ts generated successfully');
      
      // Check for the required imports
      const hasCreateServerImport = content.includes('import { CreateServerRequestSchema }');
      const hasUpdateServerImport = content.includes('import { UpdateServerRequestSchema }');
      
      console.log('CreateServerRequestSchema import:', hasCreateServerImport ? '✅' : '❌');
      console.log('UpdateServerRequestSchema import:', hasUpdateServerImport ? '✅' : '❌');
      
      if (hasCreateServerImport && hasUpdateServerImport) {
        console.log('🎉 Fix successful! All required imports are present.');
      } else {
        console.log('❌ Fix failed. Missing required imports.');
        console.log('\nGenerated file content:');
        console.log(content);
      }
    } else {
      console.log('❌ ServersResource.ts was not generated');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFix(); 