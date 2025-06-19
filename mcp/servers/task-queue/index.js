#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs-extra');
const path = require('path');

const QUEUE_PATH = process.env.TASK_QUEUE_PATH || path.join(__dirname, '../../../workspaces/shared/tasks/queue.json');

class TaskQueueServer {
  constructor() {
    this.server = new Server({
      name: 'task-queue',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_tasks',
            description: 'Get all tasks from the queue',
            inputSchema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['all', 'pending', 'in-progress', 'completed'] }
              }
            }
          },
          {
            name: 'add_task',
            description: 'Add a new task to the queue',
            inputSchema: {
              type: 'object',
              properties: {
                task: { type: 'object' }
              },
              required: ['task']
            }
          },
          {
            name: 'update_task',
            description: 'Update a task in the queue',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                updates: { type: 'object' }
              },
              required: ['taskId', 'updates']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_tasks':
          return { content: [{ type: 'text', text: await this.getTasks(args.status) }] };
        case 'add_task':
          return { content: [{ type: 'text', text: await this.addTask(args.task) }] };
        case 'update_task':
          return { content: [{ type: 'text', text: await this.updateTask(args.taskId, args.updates) }] };
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async getTasks(status = 'all') {
    try {
      const queue = await fs.readJson(QUEUE_PATH);
      let tasks = queue.queue || [];
      
      if (status !== 'all') {
        tasks = tasks.filter(t => t.status === status);
      }
      
      return JSON.stringify(tasks, null, 2);
    } catch (error) {
      return JSON.stringify([], null, 2);
    }
  }

  async addTask(task) {
    try {
      await fs.ensureDir(path.dirname(QUEUE_PATH));
      
      let queue;
      try {
        queue = await fs.readJson(QUEUE_PATH);
      } catch {
        queue = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          queue: [],
          metadata: {
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            pendingTasks: 0,
          },
        };
      }
      
      queue.queue.push(task);
      queue.metadata.totalTasks++;
      queue.metadata.pendingTasks++;
      queue.timestamp = new Date().toISOString();
      
      await fs.writeJson(QUEUE_PATH, queue, { spaces: 2 });
      return `Task added: ${task.id}`;
    } catch (error) {
      throw new Error(`Failed to add task: ${error.message}`);
    }
  }

  async updateTask(taskId, updates) {
    try {
      const queue = await fs.readJson(QUEUE_PATH);
      const taskIndex = queue.queue.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) {
        throw new Error(`Task not found: ${taskId}`);
      }
      
      const oldStatus = queue.queue[taskIndex].status;
      queue.queue[taskIndex] = { ...queue.queue[taskIndex], ...updates };
      const newStatus = queue.queue[taskIndex].status;
      
      // Update metadata
      if (oldStatus !== newStatus) {
        if (queue.metadata[`${oldStatus}Tasks`] !== undefined) {
          queue.metadata[`${oldStatus}Tasks`]--;
        }
        if (queue.metadata[`${newStatus}Tasks`] !== undefined) {
          queue.metadata[`${newStatus}Tasks`]++;
        }
      }
      
      queue.timestamp = new Date().toISOString();
      await fs.writeJson(QUEUE_PATH, queue, { spaces: 2 });
      return `Task updated: ${taskId}`;
    } catch (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Task Queue MCP server running');
  }
}

const server = new TaskQueueServer();
server.run().catch(console.error);