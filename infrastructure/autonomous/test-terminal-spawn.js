#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testTerminalSpawning() {
  console.log('🧪 Testing terminal spawning capabilities...\n');

  // Test available terminals
  const terminalOptions = [
    { name: 'terminator', command: 'terminator', args: ['--new-tab', '--title'], executeArgs: ['--execute'] },
    { name: 'gnome-terminal', command: 'gnome-terminal', args: ['--tab', '--title'], executeArgs: ['--'] },
    { name: 'xterm', command: 'xterm', args: ['-T'], executeArgs: ['-e'] },
    { name: 'x-terminal-emulator', command: 'x-terminal-emulator', args: ['-T'], executeArgs: ['-e'] }
  ];

  const availableTerminals = [];

  for (const terminal of terminalOptions) {
    try {
      await execAsync(`which ${terminal.command}`);
      availableTerminals.push(terminal);
      console.log(`✅ Found terminal: ${terminal.name} (${terminal.command})`);
    } catch (error) {
      console.log(`❌ Terminal not available: ${terminal.name}`);
    }
  }

  if (availableTerminals.length === 0) {
    console.error('\n🚨 No suitable terminal emulator found!');
    console.error('Please install one of: terminator, gnome-terminal, xterm');
    process.exit(1);
  }

  console.log(`\n🖥️ Testing with primary terminal: ${availableTerminals[0].name}`);

  // Test display environment
  console.log(`📺 Display environment: ${process.env.DISPLAY || 'Not set'}`);
  
  if (!process.env.DISPLAY) {
    console.error('🚨 No DISPLAY environment variable set - GUI terminals may not work');
    return;
  }

  // Test agent directories
  const agentRoot = '/home/w3bsuki/omg/claude-multi-agent/agents';
  const agentDirs = ['architect', 'builder', 'prd', 'qa'];
  
  console.log('\n📁 Checking agent directories...');
  for (const dir of agentDirs) {
    try {
      await execAsync(`test -d "${agentRoot}/${dir}"`);
      console.log(`✅ Agent directory exists: ${dir}`);
    } catch (error) {
      console.log(`❌ Agent directory missing: ${dir}`);
    }
  }

  // Spawn a test terminal
  console.log('\n🚀 Spawning test terminal...');
  const terminal = availableTerminals[0];
  
  let spawnArgs = [];
  if (terminal.name === 'terminator') {
    spawnArgs = [
      '--new-tab',
      '--title', 'Agent Launcher Test',
      '--execute', 'bash', '-c',
      'echo "🤖 Agent launcher test successful!"; echo "Autonomous agents can be launched in this terminal."; echo "This window will close in 10 seconds..."; for i in {10..1}; do echo "Closing in $i seconds..."; sleep 1; done'
    ];
  } else if (terminal.name === 'gnome-terminal') {
    spawnArgs = [
      '--tab',
      '--title', 'Agent Launcher Test',
      '--',
      'bash', '-c',
      'echo "🤖 Agent launcher test successful!"; echo "Autonomous agents can be launched in this terminal."; echo "This window will close in 10 seconds..."; for i in {10..1}; do echo "Closing in $i seconds..."; sleep 1; done'
    ];
  } else if (terminal.name === 'xterm' || terminal.name === 'x-terminal-emulator') {
    spawnArgs = [
      '-T', 'Agent Launcher Test',
      '-e', 'bash', '-c',
      'echo "🤖 Agent launcher test successful!"; echo "Autonomous agents can be launched in this terminal."; echo "This window will close in 10 seconds..."; for i in {10..1}; do echo "Closing in $i seconds..."; sleep 1; done'
    ];
  }

  console.log(`Command: ${terminal.command} ${spawnArgs.join(' ')}`);

  const testProcess = spawn(terminal.command, spawnArgs, {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore']
  });

  testProcess.on('exit', (code) => {
    console.log(`✅ Test terminal closed successfully (exit code: ${code})`);
  });

  testProcess.on('error', (error) => {
    console.error(`❌ Test terminal failed: ${error.message}`);
  });

  console.log('📺 Test terminal should have opened - check your screen!');
  console.log('   If you see a terminal window with a countdown, the test is successful.');
  
  // Wait a bit for the process to start
  setTimeout(() => {
    console.log('\n✅ Terminal spawning test completed!');
    console.log('🚀 Agent launcher is ready to spawn autonomous agents in visible terminals.\n');
  }, 2000);
}

// Run the test
testTerminalSpawning().catch(console.error);