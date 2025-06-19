#!/bin/bash

echo "🚀 LAUNCHING 3 AGENTS FOR NEW WORKFLOW..."

# Launch Architect Agent in separate terminal window
x-terminal-emulator -T "🏗️ Architect Agent" -e bash -c "
cd /home/w3bsuki/omg/claude-multi-agent/agents/architect
export PS1='🏗️ ARCHITECT-AGENT ➤ '
echo 'Starting Architect Agent with new workflow...'
claude --dangerously-skip-permissions --mcp-config claude_mcp_config.json; bash
" &

# Launch Builder Agent in separate terminal window
x-terminal-emulator -T "⚡ Builder Agent" -e bash -c "
cd /home/w3bsuki/omg/claude-multi-agent/agents/builder
export PS1='⚡ BUILDER-AGENT ➤ '
echo 'Starting Builder Agent with new workflow...'
claude --dangerously-skip-permissions --mcp-config claude_mcp_config.json; bash
" &

# Launch QA Agent in separate terminal window
x-terminal-emulator -T "🧪 QA Agent" -e bash -c "
cd /home/w3bsuki/omg/claude-multi-agent/agents/qa
export PS1='🧪 QA-AGENT ➤ '
echo 'Starting QA Agent with new workflow...'
claude --dangerously-skip-permissions --mcp-config claude_mcp_config.json; bash
" &

echo "✅ 3 AGENTS LAUNCHED: ARCHITECT → BUILDER → QA"
echo "No PRD Agent - using human-created PRD instead"