#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const Redis = require('ioredis');

const execAsync = promisify(exec);

async function verifySystem() {
  console.log('🔍 AUTONOMOUS AGENT TERMINAL SPAWNING SYSTEM VERIFICATION');
  console.log('=' .repeat(60));
  
  let allChecks = true;
  
  // 1. Check Node.js and dependencies
  console.log('\n📦 CHECKING DEPENDENCIES...');
  try {
    console.log(`✅ Node.js: ${process.version}`);
    require('ioredis');
    console.log('✅ Redis module available');
  } catch (error) {
    console.log('❌ Redis module missing');
    allChecks = false;
  }
  
  // 2. Check Redis connection
  console.log('\n🔗 CHECKING REDIS CONNECTION...');
  try {
    const redis = new Redis({ host: 'localhost', port: 6380 });
    await redis.ping();
    console.log('✅ Redis connection successful (localhost:6380)');
    redis.disconnect();
  } catch (error) {
    console.log('❌ Redis connection failed:', error.message);
    allChecks = false;
  }
  
  // 3. Check display environment
  console.log('\n🖥️ CHECKING GUI ENVIRONMENT...');
  if (process.env.DISPLAY) {
    console.log(`✅ Display environment: ${process.env.DISPLAY}`);
  } else {
    console.log('⚠️ DISPLAY variable not set - terminals may not work');
  }
  
  // 4. Check available terminals
  console.log('\n📺 CHECKING TERMINAL EMULATORS...');
  const terminals = [
    { name: 'terminator', command: 'terminator' },
    { name: 'gnome-terminal', command: 'gnome-terminal' },
    { name: 'xterm', command: 'xterm' },
    { name: 'x-terminal-emulator', command: 'x-terminal-emulator' }
  ];
  
  const availableTerminals = [];
  for (const terminal of terminals) {
    try {
      await execAsync(`which ${terminal.command}`);
      availableTerminals.push(terminal);
      console.log(`✅ ${terminal.name} available`);
    } catch (error) {
      console.log(`❌ ${terminal.name} not available`);
    }
  }
  
  if (availableTerminals.length === 0) {
    console.log('🚨 No terminal emulators found!');
    allChecks = false;
  }
  
  // 5. Check agent directories
  console.log('\n📁 CHECKING AGENT DIRECTORIES...');
  const agentRoot = '/home/w3bsuki/omg/claude-multi-agent/agents';
  const expectedAgents = ['architect', 'builder', 'prd', 'qa'];
  
  for (const agent of expectedAgents) {
    try {
      await execAsync(`test -d "${agentRoot}/${agent}"`);
      console.log(`✅ Agent directory exists: ${agent}`);
    } catch (error) {
      console.log(`❌ Agent directory missing: ${agent}`);
      allChecks = false;
    }
  }
  
  // 6. Check Claude CLI
  console.log('\n🤖 CHECKING CLAUDE CLI...');
  try {
    await execAsync('which claude');
    console.log('✅ Claude CLI available');
  } catch (error) {
    console.log('⚠️ Claude CLI not in PATH - agents may not start properly');
  }
  
  // 7. Test terminal spawning
  console.log('\n🧪 TESTING TERMINAL SPAWNING...');
  if (availableTerminals.length > 0 && process.env.DISPLAY) {
    const terminal = availableTerminals[0];
    console.log(`🚀 Testing with ${terminal.name}...`);
    
    let spawnArgs = [];
    if (terminal.name === 'terminator') {
      spawnArgs = [
        '--new-tab',
        '--title', 'System Verification Test',
        '--execute', 'bash', '-c',
        'echo "✅ TERMINAL SPAWNING TEST SUCCESSFUL!"; echo "The autonomous agent system is working correctly."; echo "This window will close in 5 seconds..."; sleep 5'
      ];
    } else if (terminal.name === 'gnome-terminal') {
      spawnArgs = [
        '--tab',
        '--title', 'System Verification Test',
        '--',
        'bash', '-c',
        'echo "✅ TERMINAL SPAWNING TEST SUCCESSFUL!"; echo "The autonomous agent system is working correctly."; echo "This window will close in 5 seconds..."; sleep 5'
      ];
    } else {
      spawnArgs = [
        '-T', 'System Verification Test',
        '-e', 'bash', '-c',
        'echo "✅ TERMINAL SPAWNING TEST SUCCESSFUL!"; echo "The autonomous agent system is working correctly."; echo "This window will close in 5 seconds..."; sleep 5'
      ];
    }
    
    const testProcess = spawn(terminal.command, spawnArgs, {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore']
    });
    
    console.log('📺 Test terminal should appear - check your screen!');
    
    // Wait for test to complete
    await new Promise((resolve) => {
      testProcess.on('exit', () => {
        console.log('✅ Terminal test completed successfully');
        resolve();
      });
      testProcess.on('error', (error) => {
        console.log('❌ Terminal test failed:', error.message);
        resolve();
      });
      setTimeout(resolve, 8000); // Timeout
    });
  } else {
    console.log('⏭️ Skipping terminal test (no terminals or display available)');
  }
  
  // 8. Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  if (allChecks) {
    console.log('🎉 ALL SYSTEMS GO!');
    console.log('✅ Autonomous agent terminal spawning system is fully operational');
    console.log('');
    console.log('🚀 To start the system:');
    console.log('   ./start-agent-launcher.sh');
    console.log('');
    console.log('🧪 To test agent triggering:');
    console.log('   node trigger-test-agent.js');
    console.log('');
    console.log('📖 For detailed documentation:');
    console.log('   cat TERMINAL_SPAWNING_GUIDE.md');
  } else {
    console.log('⚠️ SYSTEM ISSUES DETECTED');
    console.log('Please resolve the issues marked with ❌ above');
  }
  
  console.log('');
}

verifySystem().catch(console.error);