#!/bin/bash
cd /home/w3bsuki/omg/claude-multi-agent/agents/qa
export PS1='🧪 QA-AGENT ➤ '
echo 'Starting QA Agent...'
claude --dangerously-skip-permissions --mcp-config claude_mcp_config.json