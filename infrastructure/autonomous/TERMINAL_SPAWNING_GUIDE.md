# Terminal Spawning System for Autonomous Agents

## Overview

This system allows autonomous agents to be launched in visible terminal windows, enabling real-time observation of their work. Each agent runs in its own terminal with a clear title, making it easy to monitor multiple agents simultaneously.

## System Components

### 1. Agent Launcher (`agent-launcher.js`)
- **Purpose**: Main service that spawns agents in visible terminals
- **Features**:
  - Automatic terminal detection (terminator, gnome-terminal, xterm)
  - Fallback support for multiple terminal types
  - Agent directory validation
  - Redis-based triggering system
  - Process tracking and completion events

### 2. Test Scripts
- **`test-terminal-spawn.js`**: Tests terminal spawning capabilities
- **`trigger-test-agent.js`**: Manually triggers an agent for testing

## Terminal Support

The system supports multiple terminal emulators with automatic detection:

1. **Terminator** (Primary) - `terminator --new-tab --title "Agent Name" --execute`
2. **GNOME Terminal** - `gnome-terminal --tab --title "Agent Name" --`
3. **XTerm** - `xterm -T "Agent Name" -e`
4. **X-Terminal-Emulator** - Generic fallback

## How It Works

### Agent Spawning Process
1. Listen for Redis trigger events on `agent:trigger` channel
2. Validate agent directory exists
3. Select best available terminal emulator
4. Spawn terminal with agent-specific command
5. Track process and publish completion events

### Terminal Command Structure
Each agent is launched with:
```bash
cd /path/to/agent/directory
echo "🤖 Starting agent-name..."
claude --dangerously-skip-permissions
echo "🏁 agent-name finished - Press Enter to close"
read
```

### Agent Directory Structure
```
/home/w3bsuki/omg/claude-multi-agent/agents/
├── architect/
│   ├── claude.md
│   └── claude_mcp_config.json
├── builder/
│   ├── claude.md
│   └── claude_mcp_config.json
├── prd/
│   ├── claude.md
│   └── claude_mcp_config.json
└── qa/
    ├── claude.md
    └── claude_mcp_config.json
```

## Usage

### Starting the Agent Launcher
```bash
# Start the launcher service
node agent-launcher.js

# Start with test mode (spawns test terminal)
node agent-launcher.js --test
```

### Testing Terminal Spawning
```bash
# Test terminal detection and spawning
node test-terminal-spawn.js

# Trigger a test agent manually
node trigger-test-agent.js
```

### Triggering Agents via Redis
```javascript
const redis = new Redis({ host: 'localhost', port: 6380 });

// Trigger an agent
await redis.publish('agent:trigger', JSON.stringify({
  agent: 'architect-agent',
  trigger: 'file-change',
  timestamp: new Date().toISOString()
}));
```

## Prerequisites

### System Requirements
- Node.js with Redis connectivity
- GUI environment with DISPLAY variable set
- At least one supported terminal emulator installed

### Environment Setup
```bash
# Ensure DISPLAY is set (for GUI terminals)
echo $DISPLAY  # Should output something like ":0"

# Install a terminal emulator if needed
sudo apt install terminator  # Recommended
# OR
sudo apt install gnome-terminal
# OR  
sudo apt install xterm
```

### Redis Configuration
- Redis server running on localhost:6380
- Channels used:
  - `agent:trigger` - Incoming agent launch requests
  - `agent:completed` - Agent completion notifications

## Troubleshooting

### No Terminal Appears
1. Check if DISPLAY environment variable is set: `echo $DISPLAY`
2. Verify terminal emulator is installed: `which terminator`
3. Test GUI access: Try running `xterm` manually
4. Check agent directory exists and is accessible

### Agent Launch Errors
1. Verify Redis connection (localhost:6380)
2. Check agent directory structure
3. Ensure claude CLI is available in PATH
4. Review launcher logs for specific error messages

### Terminal Detection Issues
The launcher will automatically detect available terminals. Priority order:
1. Terminator (best tab support)
2. GNOME Terminal
3. XTerm (basic fallback)
4. X-Terminal-Emulator (generic fallback)

## Monitoring

### Real-time Monitoring
- Each agent terminal shows live output
- Terminal titles clearly identify which agent is running
- Progress messages indicate agent status

### Event Tracking
- Agent launch events logged to console
- Completion events published to Redis
- Error handling with detailed logging

## Security Notes

- Agents run with `--dangerously-skip-permissions` flag
- Each agent operates in its own directory sandbox
- Terminal processes are detached for autonomous operation
- User can observe but agents run independently

## Success Criteria

✅ **Terminal Detection**: System finds and configures available terminals  
✅ **Agent Directory Validation**: Confirms all agent directories exist  
✅ **Terminal Spawning**: Successfully opens visible terminals  
✅ **Process Tracking**: Monitors agent execution and completion  
✅ **Redis Integration**: Responds to trigger events correctly  
✅ **Error Handling**: Graceful handling of failures  
✅ **Multi-Terminal Support**: Works with different terminal emulators  

The terminal spawning system is now fully functional and ready for autonomous agent deployment!