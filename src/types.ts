export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  role: Role;
  content: string;
  name?: string;
  tool_call_id?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  messages: Message[];
  metadata?: Record<string, any>;
}

export interface CompressionOptions {
  targetTokens?: number;
  strategy: 'summarize' | 'prune' | 'group' | 'hybrid';
  preserveSystemMessages?: boolean;
  minMessagesToKeep?: number;
}

export interface CompressionResult {
  compressedConversation: Conversation;
  originalTokenCount: number;
  compressedTokenCount: number;
  compressionRatio: number;
  summary?: string;
}
