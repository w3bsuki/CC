"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterAgentServer = void 0;
const simple_message_bus_1 = require("./simple-message-bus");
const eventemitter3_1 = require("eventemitter3");
class InterAgentServer {
    constructor(redisUrl = 'redis://localhost:6379', redisPassword) {
        this.messageBus = new simple_message_bus_1.SimpleMessageBus(redisUrl, redisPassword);
        this.agentRegistry = new Map();
        this.messageHandlers = new Map();
        this.emitter = new eventemitter3_1.EventEmitter();
        this.heartbeatIntervals = new Map();
    }
    // Agent Registry Methods
    async registerAgent(info) {
        const agentInfo = {
            ...info,
            lastHeartbeat: new Date().toISOString()
        };
        this.agentRegistry.set(info.id, agentInfo);
        // Subscribe to agent's messages
        this.messageBus.subscribe(info.id, (message) => {
            this.handleAgentMessage(info.id, message);
        });
        // Start heartbeat monitoring
        this.startHeartbeatMonitor(info.id);
        // Broadcast agent registration
        await this.messageBus.sendMessage('system', 'all', 'broadcast', {
            event: 'agent_registered',
            agent: agentInfo
        });
        console.log(`Agent registered: ${info.id} (${info.role})`);
    }
    async unregisterAgent(agentId) {
        const agent = this.agentRegistry.get(agentId);
        if (!agent)
            return;
        // Stop heartbeat monitoring
        const interval = this.heartbeatIntervals.get(agentId);
        if (interval) {
            clearInterval(interval);
            this.heartbeatIntervals.delete(agentId);
        }
        // Remove from registry
        this.agentRegistry.delete(agentId);
        // Broadcast agent unregistration
        await this.messageBus.sendMessage('system', 'all', 'broadcast', {
            event: 'agent_unregistered',
            agentId
        });
        console.log(`Agent unregistered: ${agentId}`);
    }
    updateAgentStatus(agentId, status, currentTask) {
        const agent = this.agentRegistry.get(agentId);
        if (agent) {
            agent.status = status;
            agent.currentTask = currentTask;
            agent.lastHeartbeat = new Date().toISOString();
        }
    }
    getAgent(agentId) {
        return this.agentRegistry.get(agentId);
    }
    getAgentsByRole(role) {
        return Array.from(this.agentRegistry.values()).filter(agent => agent.role === role);
    }
    getAvailableAgents() {
        return Array.from(this.agentRegistry.values()).filter(agent => agent.status === 'idle' && this.isAgentAlive(agent.id));
    }
    // Message Routing Methods
    async sendToAgent(from, to, payload, options) {
        const toAgent = this.agentRegistry.get(to);
        if (!toAgent || !this.isAgentAlive(to)) {
            throw new Error(`Agent ${to} is not available`);
        }
        return this.messageBus.sendMessage(from, to, 'direct', payload, {
            correlationId: options?.correlationId
        });
    }
    async broadcastToRole(from, role, payload, options) {
        const agents = this.getAgentsByRole(role);
        const messageIds = [];
        for (const agent of agents) {
            if (this.isAgentAlive(agent.id)) {
                const id = await this.sendToAgent(from, agent.id, payload, options);
                messageIds.push(id);
            }
        }
        return messageIds;
    }
    async requestResponse(from, to, payload, timeout = 30000) {
        const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                this.emitter.off(`response:${correlationId}`);
                reject(new Error(`Request timeout after ${timeout}ms`));
            }, timeout);
            this.emitter.once(`response:${correlationId}`, (response) => {
                clearTimeout(timer);
                resolve(response);
            });
            await this.sendToAgent(from, to, payload, {
                requiresResponse: true,
                correlationId,
                timeout
            });
        });
    }
    // Message Handling
    async handleAgentMessage(agentId, message) {
        // Update agent heartbeat
        const agent = this.agentRegistry.get(agentId);
        if (agent) {
            agent.lastHeartbeat = new Date().toISOString();
        }
        // Handle system messages
        if (message.type === 'event' && message.payload.event === 'heartbeat') {
            return; // Heartbeat handled above
        }
        // Handle response messages
        if (message.type === 'response' && message.correlationId) {
            this.emitter.emit(`response:${message.correlationId}`, message.payload);
            return;
        }
        // Route to message handlers
        const handler = this.messageHandlers.get(message.to);
        if (handler) {
            try {
                const response = await handler(message);
                if (message.replyTo && response !== undefined) {
                    await this.messageBus.sendMessage(message.to, message.from, 'response', response, { correlationId: message.correlationId });
                }
            }
            catch (error) {
                console.error(`Error handling message for ${message.to}:`, error);
            }
        }
    }
    registerMessageHandler(agentId, handler) {
        this.messageHandlers.set(agentId, handler);
    }
    // Health & Monitoring
    startHeartbeatMonitor(agentId) {
        const interval = setInterval(async () => {
            const agent = this.agentRegistry.get(agentId);
            if (!agent) {
                clearInterval(interval);
                return;
            }
            const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
            const now = Date.now();
            // If no heartbeat for 60 seconds, mark as offline
            if (now - lastHeartbeat > 60000) {
                agent.status = 'offline';
                await this.messageBus.sendMessage('system', 'all', 'broadcast', {
                    event: 'agent_offline',
                    agentId
                });
            }
        }, 30000); // Check every 30 seconds
        this.heartbeatIntervals.set(agentId, interval);
    }
    isAgentAlive(agentId) {
        const agent = this.agentRegistry.get(agentId);
        if (!agent)
            return false;
        const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
        const now = Date.now();
        return now - lastHeartbeat < 60000; // Alive if heartbeat within last minute
    }
    async sendHeartbeat(agentId) {
        await this.messageBus.sendMessage(agentId, agentId, 'event', { event: 'heartbeat', timestamp: new Date().toISOString() });
    }
    // Persistence Methods
    async saveMessageHistory(agentId, filepath) {
        const messages = this.messageBus.getMessages(agentId);
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        await fs.writeFile(filepath, JSON.stringify(messages, null, 2));
    }
    async loadMessageHistory(agentId, filepath) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const data = await fs.readFile(filepath, 'utf-8');
        const messages = JSON.parse(data);
        // Re-add messages to history
        for (const message of messages) {
            await this.messageBus.sendMessage(message.from, message.to, message.type, message.payload, {
                correlationId: message.correlationId,
                replyTo: message.replyTo
            });
        }
    }
    // Utility Methods
    getSystemStatus() {
        const agents = Array.from(this.agentRegistry.values());
        return {
            totalAgents: agents.length,
            onlineAgents: agents.filter(a => this.isAgentAlive(a.id)).length,
            agentsByRole: agents.reduce((acc, agent) => {
                acc[agent.role] = (acc[agent.role] || 0) + 1;
                return acc;
            }, {}),
            agentsByStatus: agents.reduce((acc, agent) => {
                acc[agent.status] = (acc[agent.status] || 0) + 1;
                return acc;
            }, {}),
            agents: agents.map(a => ({
                id: a.id,
                role: a.role,
                status: a.status,
                alive: this.isAgentAlive(a.id),
                currentTask: a.currentTask
            }))
        };
    }
    async stop() {
        // Clear all heartbeat intervals
        for (const interval of this.heartbeatIntervals.values()) {
            clearInterval(interval);
        }
        this.heartbeatIntervals.clear();
        // Stop message bus
        await this.messageBus.stop();
    }
}
exports.InterAgentServer = InterAgentServer;
