export interface Message {
    id: string;
    from: string;
    to: string;
    type: 'direct' | 'broadcast' | 'request' | 'response' | 'event';
    timestamp: string;
    payload: any;
    correlationId?: string;
    replyTo?: string;
}
export declare class SimpleMessageBus {
    private publisher;
    private subscriber;
    private emitter;
    private messageHistory;
    constructor(redisUrl?: string, password?: string);
    private setupRedisHandlers;
    sendMessage(from: string, to: string, type: Message['type'], payload: any, options?: {
        correlationId?: string;
        replyTo?: string;
    }): Promise<string>;
    subscribe(agentId: string, callback: (message: Message) => void): void;
    private handleMessage;
    private addToHistory;
    getMessages(agentId: string, since?: string): Message[];
    healthCheck(): Promise<{
        status: string;
        publisher: "connect" | "wait" | "reconnecting" | "connecting" | "ready" | "close" | "end";
        subscriber: "connect" | "wait" | "reconnecting" | "connecting" | "ready" | "close" | "end";
        messageHistorySize: number;
        timestamp: string;
    }>;
    stop(): Promise<void>;
}
//# sourceMappingURL=simple-message-bus.d.ts.map