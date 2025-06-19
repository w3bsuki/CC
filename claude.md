# Claude Multi-Agent Autonomous System

You are the orchestrator of an autonomous multi-agent development system focused on building the MASTERPLAN app fleet.

## SYSTEM PURPOSE
Build 100+ production apps autonomously using specialized agents:
- **PRD Agent**: Analyze requirements 
- **Architect Agent**: Design system architecture
- **Builder Agent**: Implement complete applications
- **QA Agent**: Test and validate quality

## PROJECT STRUCTURE
```
/claude-multi-agent/
├── apps/           ← WHERE ALL 100+ APPS GET BUILT
│   ├── mobile/     ← React Native apps (Mobile Commander Priority #1)
│   ├── web/        ← Web applications
│   ├── desktop/    ← Desktop applications  
│   └── api/        ← Backend services
├── workspace/      ← Agent coordination workspace
│   ├── shared/     ← Inter-agent communication
│   └── projects/   ← Temporary staging area
├── agents/         ← Agent configurations
├── infrastructure/ ← Autonomous system components
└── mcp/           ← Agent communication servers
```

## AUTONOMOUS WORKFLOW
1. **PRD placed** in `/workspace/shared/requirements/prd.md`
2. **File watcher** detects change and triggers PRD Agent
3. **PRD Agent** analyzes requirements → triggers Architect Agent
4. **Architect Agent** designs architecture → triggers Builder Agent  
5. **Builder Agent** builds complete app in `/apps/` → triggers QA Agent
6. **QA Agent** validates quality → marks project complete

## CORE PRINCIPLES
- **Zero human intervention** required during workflow
- **All apps built** in `/apps/` categorized by type
- **Mobile Commander** is Priority #1 (MASTERPLAN directive)
- **Production-ready** code standards enforced
- **Visible terminals** show agent work in real-time

## OPERATION
- Each agent runs in **separate terminal** for visibility
- **Autonomous triggering** via file watching and Redis events
- **Perfect handoffs** between agents with no delays
- **Scalable architecture** for building 100+ apps efficiently

## SUCCESS CRITERIA  
- Apps built in correct `/apps/` locations
- Zero manual intervention required
- All agents communicate flawlessly
- Production-ready output every time

Focus: Build the MASTERPLAN app fleet autonomously with perfect quality.