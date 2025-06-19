#!/bin/bash

echo "🚀 Starting Autonomous Agent Launcher..."
echo "📍 Working directory: $(pwd)"
echo "🔧 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi
echo "✅ Node.js available: $(node --version)"

# Check Redis connection
if ! node -e "const Redis = require('ioredis'); const redis = new Redis({host: 'localhost', port: 6380}); redis.ping().then(() => process.exit(0)).catch(() => process.exit(1))" &> /dev/null; then
    echo "❌ Redis connection failed (localhost:6380)"
    exit 1
fi
echo "✅ Redis connection successful"

# Check display environment
if [ -z "$DISPLAY" ]; then
    echo "⚠️ DISPLAY environment variable not set - GUI terminals may not work"
else
    echo "✅ Display environment: $DISPLAY"
fi

# Check terminal availability
if command -v terminator &> /dev/null; then
    echo "✅ Terminator terminal available"
elif command -v gnome-terminal &> /dev/null; then
    echo "✅ GNOME Terminal available"
elif command -v xterm &> /dev/null; then
    echo "✅ XTerm available"
else
    echo "⚠️ No preferred terminal emulator found"
fi

echo ""
echo "🎯 All prerequisites met! Starting agent launcher..."
echo "🔄 Agent launcher will run in background and spawn terminals as needed"
echo "📺 Watch for new terminal windows when agents are triggered"
echo ""

# Start the launcher
exec node agent-launcher.js