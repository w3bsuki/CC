export declare class MessageBusServer {
    private publisher;
    private subscriber;
    private emitter;
    private subscriptions;
    private messageHistory;
    private mcpServer;
    private circuitBreaker;
    private metrics;
    private secretKey?;
    constructor(redisUrl?: string, password?: string, secretKey?: string);
    private setupResourceHandlers;
    private setupMcpTools;
    private setupRedisHandlers;
    private publishMessage;
    private handleMessage;
    private shouldReceiveMessage;
    private addToHistory;
    private removeFromHistory;
    private subscribe;
    private unsubscribe;
    private getMessages;
    private healthCheck;
    private validateAgentPermission;
    private generateMessageId;
    private signMessage;
    private verifyMessage;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=message-bus-improved.d.ts.map