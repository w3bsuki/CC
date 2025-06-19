#!/bin/bash

echo "🛑 Stopping Autonomous Multi-Agent System..."

if [ -f /tmp/autonomous-system.pids ]; then
  while read pid; do
    if kill -0 $pid 2>/dev/null; then
      kill $pid
      echo "Stopped process $pid"
    fi
  done < /tmp/autonomous-system.pids
  rm /tmp/autonomous-system.pids
fi

echo "✅ Autonomous system stopped"