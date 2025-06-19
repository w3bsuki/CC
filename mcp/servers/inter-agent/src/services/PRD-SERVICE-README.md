# PRD Agent Service

The PRD Agent Service is a wrapper that extends the `AgentBaseService` class to provide PRD (Product Requirements Document) parsing and requirement extraction capabilities within the inter-agent communication system.

## Features

- **PRD Parsing**: Parses markdown PRDs into structured requirements
- **Feature Extraction**: Extracts features and acceptance criteria
- **Requirement ID Generation**: Generates unique IDs for requirements
- **Task Generation**: Creates initial task lists based on requirements
- **Inter-agent Communication**: Integrates with the inter-agent server for communication
- **Health Monitoring**: Built-in health checking and recovery mechanisms
- **File-based Workflow**: Maintains compatibility with existing file-based workflows

## Architecture

The PRD Agent Service:
1. Extends `AgentBaseService` for standard agent functionality
2. Maintains compatibility with the existing PRD agent code
3. Implements required abstract methods (initialize, cleanup, processMessage, checkHealth)
4. Handles PRD parsing and requirement extraction
5. Outputs to `shared/requirements/requirements.json`
6. Works with the existing task agent through inter-agent messaging

## Usage

### Basic Setup

```typescript
import { InterAgentServer } from '../inter-agent-server';
import { PRDAgentService } from './PRDAgentService';

// Initialize inter-agent server
const interAgentServer = new InterAgentServer('redis://localhost:6379');

// Configure PRD agent
const config = {
  id: 'prd-agent-001',
  role: 'prd' as const,
  name: 'PRD Parser Agent',
  capabilities: ['parse-markdown', 'extract-requirements'],
  workspacePath: '/path/to/workspace'
};

// Create and start the service
const prdAgent = new PRDAgentService({
  interAgentServer,
  config
});

await prdAgent.start();
```

### Message Types

The PRD Agent Service handles the following message types:

#### 1. `process-prd`
Processes a PRD file from the filesystem.

```typescript
await interAgentServer.sendToAgent(
  'orchestrator',
  'prd-agent-001',
  {
    type: 'process-prd',
    payload: {
      prdPath: 'shared/requirements/prd.md'
    }
  }
);
```

#### 2. `parse-requirements`
Parses PRD content directly.

```typescript
await interAgentServer.sendToAgent(
  'orchestrator',
  'prd-agent-001',
  {
    type: 'parse-requirements',
    payload: {
      content: '# Product Requirements Document...'
    }
  }
);
```

#### 3. `get-requirements`
Retrieves parsed requirements.

```typescript
const response = await interAgentServer.requestResponse(
  'orchestrator',
  'prd-agent-001',
  {
    type: 'get-requirements',
    payload: {}
  }
);
```

#### 4. `update-requirement-status`
Updates the status of a specific requirement.

```typescript
await interAgentServer.sendToAgent(
  'orchestrator',
  'prd-agent-001',
  {
    type: 'update-requirement-status',
    payload: {
      requirementId: 'req-001',
      status: 'completed'
    }
  }
);
```

## Auto-start Feature

If a PRD file exists at `shared/requirements/prd.md` when the agent starts, it will automatically process it after a 2-second delay.

## Output Structure

The service outputs parsed requirements to `shared/context/requirements.json`:

```json
{
  "documentId": "prd-1234567890",
  "title": "Product Title",
  "overview": "Product overview...",
  "features": [
    {
      "id": "feat-001",
      "name": "Feature Name",
      "description": "Feature description",
      "requirements": ["req-001", "req-002"],
      "priority": "high",
      "status": "pending"
    }
  ],
  "requirements": [
    {
      "id": "req-001",
      "type": "functional",
      "description": "Requirement description",
      "priority": "high",
      "status": "pending",
      "featureId": "feat-001"
    }
  ],
  "estimatedTasks": 15,
  "metadata": {
    "parsedAt": "2023-10-01T12:00:00Z",
    "version": "1.0",
    "checksum": "abc123..."
  }
}
```

## Health Monitoring

The service includes health checking that verifies:
- Required directories exist
- File read/write permissions
- Service responsiveness

Health checks run every 30 seconds and can trigger automatic recovery.

## Integration with Task Agent

After parsing requirements, the PRD Agent automatically notifies the Task Agent (if available) with:
- Path to requirements file
- Feature and requirement counts
- Estimated task count
- Summary information

## Error Handling

The service includes comprehensive error handling:
- Recoverable errors trigger automatic recovery attempts
- Non-recoverable errors are logged and reported
- Failed PRD processing updates agent status to 'blocked'

## Development

### Running the Test Service

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Dependencies

- `marked`: Markdown parsing
- `zod`: Schema validation
- `fs-extra`: Enhanced file operations
- `eventemitter3`: Event handling
- `ioredis`: Redis communication (via inter-agent server)

## Extending the Service

To add new capabilities:

1. Add new message type handling in `processMessage()`
2. Implement the handler method
3. Update health checks if needed
4. Document the new message type

## Migration from Standalone PRD Agent

To migrate from the standalone PRD agent:

1. Replace direct instantiation with service creation
2. Use inter-agent messaging instead of console output
3. Leverage built-in health monitoring
4. Utilize the inter-agent server for communication

The service maintains backward compatibility with existing file paths and output formats.