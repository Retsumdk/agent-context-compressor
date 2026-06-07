import { Message } from './types';

/**
 * Basic token estimation (approx 4 chars per token for English text)
 */
export function estimateTokens(messages: Message[]): number {
  let count = 0;
  for (const msg of messages) {
    // Basic overhead per message
    count += 4;
    
    // Content estimation
    count += Math.ceil(msg.content.length / 4);
    
    // Role overhead
    count += Math.ceil((msg.role?.length || 0) / 4);
    
    // Name overhead
    if (msg.name) {
      count += Math.ceil(msg.name.length / 4);
    }
  }
  return count;
}

/**
 * Calculates compression ratio as (1 - compressed/original)
 */
export function calculateCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 0;
  return Number((1 - compressed / original).toFixed(4));
}

/**
 * Chunk messages into groups of roughly N tokens
 */
export function chunkMessages(messages: Message[], maxTokensPerChunk: number): Message[][] {
  const chunks: Message[][] = [];
  let currentChunk: Message[] = [];
  let currentTokens = 0;

  for (const msg of messages) {
    const tokens = estimateTokens([msg]);
    if (currentTokens + tokens > maxTokensPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [msg];
      currentTokens = tokens;
    } else {
      currentChunk.push(msg);
      currentTokens += tokens;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Validates a conversation object
 */
export function validateConversation(conv: any): boolean {
  if (!conv || typeof conv !== 'object') return false;
  if (!Array.isArray(conv.messages)) return false;
  
  for (const msg of conv.messages) {
    if (!msg.role || !msg.content) return false;
    if (!['user', 'assistant', 'system', 'tool'].includes(msg.role)) return false;
  }
  
  return true;
}

/**
 * Formats a message for logging/display
 */
export function formatMessage(msg: Message): string {
  const timestamp = msg.timestamp ? ` [${new Date(msg.timestamp).toISOString()}]` : '';
  const name = msg.name ? ` (${msg.name})` : '';
  return `${msg.role.toUpperCase()}${name}${timestamp}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`;
}
