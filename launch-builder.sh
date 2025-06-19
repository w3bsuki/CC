#!/bin/bash
cd /home/w3bsuki/omg/claude-multi-agent/agents/builder
export PS1='⚡ BUILDER-AGENT ➤ '
echo 'Starting Builder Agent...'
claude --dangerously-skip-permissions --mcp-config claude_mcp_config.json