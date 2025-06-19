const Redis = require('ioredis');
const { spawn, exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

class AutonomousAgentLauncher {
  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6380
    });
    
    this.agentRoot = '/home/w3bsuki/omg/claude-multi-agent/agents';
    this.activeAgents = new Map();
    this.availableTerminals = [];
    
    this.initialize();
  }

  async initialize() {
    await this.detectTerminals();
    this.setupTriggerListeners();
    
    // Test terminal spawning if requested
    if (process.argv.includes('--test')) {
      setTimeout(() => this.testTerminalSpawn(), 1000);
    }
  }

  async detectTerminals() {
    const terminalOptions = [
      { name: 'terminator', command: 'terminator', args: ['--new-tab', '--title'], executeArgs: ['--execute'] },
      { name: 'gnome-terminal', command: 'gnome-terminal', args: ['--tab', '--title'], executeArgs: ['--'] },
      { name: 'xterm', command: 'xterm', args: ['-T'], executeArgs: ['-e'] },
      { name: 'x-terminal-emulator', command: 'x-terminal-emulator', args: ['-T'], executeArgs: ['-e'] }
    ];

    for (const terminal of terminalOptions) {
      try {
        await execAsync(`which ${terminal.command}`);
        this.availableTerminals.push(terminal);
        console.log(`✅ Found terminal: ${terminal.name}`);
      } catch (error) {
        console.log(`❌ Terminal not available: ${terminal.name}`);
      }
    }

    if (this.availableTerminals.length === 0) {
      console.error('🚨 No suitable terminal emulator found! Please install terminator, gnome-terminal, or xterm.');
      process.exit(1);
    }

    console.log(`🖥️ Will use ${this.availableTerminals[0].name} as primary terminal`);
  }

  setupTriggerListeners() {
    // Listen for agent trigger events
    this.redis.subscribe('agent:trigger');
    this.redis.on('message', (channel, message) => {
      if (channel === 'agent:trigger') {
        const event = JSON.parse(message);
        this.launchAgent(event.agent, event.trigger);
      }
    });

    console.log('🚀 Autonomous agent launcher ready');
  }

  async launchAgent(agentRole, trigger) {
    console.log(`🤖 Launching ${agentRole} in terminal (trigger: ${trigger})`);
    
    // Don't launch if already running
    if (this.activeAgents.has(agentRole)) {
      console.log(`⚠️ ${agentRole} already running`);
      return;
    }

    const agentDir = path.join(this.agentRoot, agentRole.replace('-agent', ''));
    
    // Verify agent directory exists
    try {
      await execAsync(`test -d "${agentDir}"`);
    } catch (error) {
      console.error(`❌ Agent directory not found: ${agentDir}`);
      return;
    }

    // Use the first available terminal
    const terminal = this.availableTerminals[0];
    const title = `${agentRole} - Autonomous Work`;
    
    // Build command based on terminal type
    let spawnArgs = [];
    let command = terminal.command;
    
    if (terminal.name === 'terminator') {
      spawnArgs = [
        '--new-tab',
        '--title', title,
        '--execute', 'bash', '-c',
        `cd "${agentDir}" && echo "🤖 Starting ${agentRole}..." && claude --dangerously-skip-permissions; echo "🏁 ${agentRole} finished - Press Enter to close"; read`
      ];
    } else if (terminal.name === 'gnome-terminal') {
      spawnArgs = [
        '--tab',
        '--title', title,
        '--',
        'bash', '-c',
        `cd "${agentDir}" && echo "🤖 Starting ${agentRole}..." && claude --dangerously-skip-permissions; echo "🏁 ${agentRole} finished - Press Enter to close"; read`
      ];
    } else if (terminal.name === 'xterm' || terminal.name === 'x-terminal-emulator') {
      spawnArgs = [
        '-T', title,
        '-e', 'bash', '-c',
        `cd "${agentDir}" && echo "🤖 Starting ${agentRole}..." && claude --dangerously-skip-permissions; echo "🏁 ${agentRole} finished - Press Enter to close"; read`
      ];
    }

    console.log(`🖥️ Spawning: ${command} ${spawnArgs.join(' ')}`);
    
    // Launch in visible terminal
    const agentProcess = spawn(command, spawnArgs, {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore']
    });

    this.activeAgents.set(agentRole, agentProcess);

    // Track when terminal closes (agent completes)
    agentProcess.on('exit', (code) => {
      console.log(`✅ ${agentRole} terminal closed (code: ${code})`);
      this.activeAgents.delete(agentRole);
      
      // Publish completion event
      this.redis.publish('agent:completed', JSON.stringify({
        agent: agentRole,
        exitCode: code,
        timestamp: new Date().toISOString()
      }));
    });

    agentProcess.on('error', (error) => {
      console.error(`❌ Failed to launch ${agentRole}:`, error.message);
      this.activeAgents.delete(agentRole);
    });

    console.log(`📺 ${agentRole} launched in new terminal using ${terminal.name}`);
  }

  // Add a test method to verify terminal spawning
  async testTerminalSpawn() {
    console.log('🧪 Testing terminal spawning...');
    
    const terminal = this.availableTerminals[0];
    let spawnArgs = [];
    let command = terminal.command;
    
    if (terminal.name === 'terminator') {
      spawnArgs = [
        '--new-tab',
        '--title', 'Test Terminal',
        '--execute', 'bash', '-c',
        'echo "✅ Terminal spawn test successful!"; echo "This terminal will close in 5 seconds..."; sleep 5'
      ];
    } else if (terminal.name === 'gnome-terminal') {
      spawnArgs = [
        '--tab',
        '--title', 'Test Terminal',
        '--',
        'bash', '-c',
        'echo "✅ Terminal spawn test successful!"; echo "This terminal will close in 5 seconds..."; sleep 5'
      ];
    } else if (terminal.name === 'xterm' || terminal.name === 'x-terminal-emulator') {
      spawnArgs = [
        '-T', 'Test Terminal',
        '-e', 'bash', '-c',
        'echo "✅ Terminal spawn test successful!"; echo "This terminal will close in 5 seconds..."; sleep 5'
      ];
    }

    const testProcess = spawn(command, spawnArgs, {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore']
    });

    testProcess.on('exit', (code) => {
      console.log(`🧪 Test terminal closed (code: ${code})`);
    });

    testProcess.on('error', (error) => {
      console.error(`❌ Test terminal failed:`, error.message);
    });

    console.log(`🧪 Test terminal spawned using ${terminal.name}`);
  }
}

// Start autonomous launcher
new AutonomousAgentLauncher();