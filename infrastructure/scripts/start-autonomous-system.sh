#!/bin/bash

echo "🚀 Starting Autonomous Multi-Agent System..."

# Ensure Redis is running
redis-cli -p 6380 ping >/dev/null 2>&1 || {
  echo "Starting Redis server..."
  docker start redis-autonomous-new 2>/dev/null || docker run --name redis-autonomous-new -p 6380:6379 -d redis:7-alpine
  sleep 2
}

# Start file watcher in background
echo "📁 Starting file watcher..."
cd /home/w3bsuki/omg/infrastructure/autonomous
nohup node file-watcher.js > /tmp/file-watcher.log 2>&1 &
FILE_WATCHER_PID=$!

# Start agent launcher in background  
echo "🤖 Starting agent launcher..."
nohup node agent-launcher.js > /tmp/agent-launcher.log 2>&1 &
AGENT_LAUNCHER_PID=$!

# Start monitoring dashboard
echo "📊 Starting monitoring dashboard..."
cd ../monitoring
nohup npm start > /tmp/monitoring.log 2>&1 &
MONITOR_PID=$!

echo "✅ Autonomous system started!"
echo "📋 Place PRD in: /workspace/shared/requirements/prd.md"
echo "🔍 Watch logs: tail -f /tmp/file-watcher.log"
echo "📊 Monitor: http://localhost:3000"

# Save PIDs for cleanup
echo $FILE_WATCHER_PID > /tmp/autonomous-system.pids
echo $AGENT_LAUNCHER_PID >> /tmp/autonomous-system.pids  
echo $MONITOR_PID >> /tmp/autonomous-system.pids

echo "🛑 To stop: infrastructure/scripts/stop-autonomous-system.sh"