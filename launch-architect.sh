#!/bin/bash
cd /home/w3bsuki/omg/claude-multi-agent/agents/architect
export PS1='🏗️ ARCHITECT-AGENT ➤ '
echo 'Starting Architect Agent...'
claude --dangerously-skip-permissions --mcp-config claude_mcp_config.json