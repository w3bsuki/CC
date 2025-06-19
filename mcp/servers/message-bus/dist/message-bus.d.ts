export declare class MessageBusServer {
    private publisher;
    private subscriber;
    private emitter;
    private subscriptions;
    private messageHistory;
    private mcpServer;
    constructor(redisUrl?: string, password?: string);
    private setupMcpTools;
    private setupRedisHandlers;
    private publishMessage;
    private handleMessage;
    private addToHistory;
    private subscribe;
    private getMessages;
    private healthCheck;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=message-bus.d.ts.map