#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = '/home/w3bsuki/omg/claude-multi-agent/omg-new/mcp/config/autonomous-mcp.json';

async function validateMcpConfiguration() {
  console.log('🔍 Validating MCP Configuration...\n');
  
  // Check if config file exists
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('❌ Config file not found:', CONFIG_FILE);
    process.exit(1);
  }
  
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ Invalid JSON in config file:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Config file loaded successfully');
  
  // Validate each MCP server
  const servers = config.mcpServers || {};
  let allValid = true;
  
  for (const [serverName, serverConfig] of Object.entries(servers)) {
    console.log(`\n📋 Validating server: ${serverName}`);
    
    // Check command exists
    if (!serverConfig.command) {
      console.error(`  ❌ Missing command for ${serverName}`);
      allValid = false;
      continue;
    }
    
    // Check if it's a local file (starts with /) or npm package
    if (serverConfig.command === 'node') {
      const scriptPath = serverConfig.args[0];
      if (scriptPath.startsWith('/')) {
        // Local file - check if it exists
        if (!fs.existsSync(scriptPath)) {
          console.error(`  ❌ Script file not found: ${scriptPath}`);
          allValid = false;
        } else {
          console.log(`  ✅ Script file exists: ${scriptPath}`);
        }
      }
    } else if (serverConfig.command === 'npx') {
      console.log(`  📦 NPX package: ${serverConfig.args.join(' ')}`);
    } else {
      console.log(`  🔧 Command: ${serverConfig.command}`);
    }
    
    // Check environment variables
    const env = serverConfig.env || {};
    for (const [envKey, envValue] of Object.entries(env)) {
      if (envValue.includes('/home/w3bsuki/omg/workspace') || envValue.includes('/home/w3bsuki/omg/claude-multi-agent')) {
        // Check if directory/file exists
        if (envValue.endsWith('.json') || envValue.includes('.')) {
          // File check
          const dir = path.dirname(envValue);
          if (!fs.existsSync(dir)) {
            console.log(`  ⚠️  Directory for ${envKey} doesn't exist yet: ${dir}`);
          } else {
            console.log(`  ✅ Directory exists for ${envKey}: ${dir}`);
          }
        } else {
          // Directory check
          if (!fs.existsSync(envValue)) {
            console.log(`  ⚠️  Directory for ${envKey} doesn't exist yet: ${envValue}`);
          } else {
            console.log(`  ✅ Directory exists for ${envKey}: ${envValue}`);
          }
        }
      } else if (envValue.includes('${') || envValue.startsWith('redis://')) {
        console.log(`  🔧 Environment variable ${envKey}: ${envValue}`);
      } else {
        console.log(`  📝 Setting ${envKey}: ${envValue}`);
      }
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   Total servers configured: ${Object.keys(servers).length}`);
  console.log(`   Local MCP servers: ${Object.values(servers).filter(s => s.command === 'node' && s.args[0].startsWith('/')).length}`);
  console.log(`   NPM package servers: ${Object.values(servers).filter(s => s.command === 'npx').length}`);
  
  if (allValid) {
    console.log('\n🎉 All MCP servers validated successfully!');
    return true;
  } else {
    console.log('\n⚠️  Some issues found with MCP configuration');
    return false;
  }
}

// List all preserved MCP servers
function listPreservedServers() {
  console.log('\n📦 Preserved MCP Servers:');
  
  const serversDir = '/home/w3bsuki/omg/claude-multi-agent/omg-new/mcp/servers';
  if (fs.existsSync(serversDir)) {
    const servers = fs.readdirSync(serversDir);
    servers.forEach(server => {
      const serverPath = path.join(serversDir, server);
      if (fs.statSync(serverPath).isDirectory()) {
        console.log(`  📁 ${server}`);
        
        // Check for key files
        const packageJsonPath = path.join(serverPath, 'package.json');
        const indexJsPath = path.join(serverPath, 'index.js');
        
        if (fs.existsSync(packageJsonPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            console.log(`     📄 ${pkg.name} v${pkg.version}`);
          } catch (e) {
            console.log(`     📄 package.json exists`);
          }
        }
        
        if (fs.existsSync(indexJsPath)) {
          console.log(`     🚀 index.js ready`);
        }
      }
    });
  }
}

if (require.main === module) {
  validateMcpConfiguration()
    .then(() => {
      listPreservedServers();
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

module.exports = { validateMcpConfiguration };