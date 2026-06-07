import { Message, Conversation, CompressionOptions, CompressionResult } from './types';
import { estimateTokens, calculateCompressionRatio } from './utils';
import { SummarizationStrategy } from './strategies/summarizer';
import { PruningStrategy } from './strategies/pruning';
import { GroupingStrategy } from './strategies/grouping';

export class AgentContextCompressor {
  private summarizer: SummarizationStrategy;
  private pruner: PruningStrategy;
  private grouper: GroupingStrategy;

  constructor(apiKey?: string) {
    this.summarizer = new SummarizationStrategy(apiKey);
    this.pruner = new PruningStrategy();
    this.grouper = new GroupingStrategy();
  }

  /**
   * Compresses a conversation based on the provided options.
   */
  async compress(conversation: Conversation, options: CompressionOptions): Promise<CompressionResult> {
    const originalTokenCount = estimateTokens(conversation.messages);
    let compressedMessages = [...conversation.messages];

    if (compressedMessages.length === 0) {
      return this.emptyResult(originalTokenCount);
    }

    switch (options.strategy) {
      case 'summarize':
        compressedMessages = await this.summarizer.apply(compressedMessages, options);
        break;
      case 'prune':
        compressedMessages = await this.pruner.apply(compressedMessages, options);
        break;
      case 'group':
        compressedMessages = await this.grouper.apply(compressedMessages, options);
        break;
      case 'hybrid':
        compressedMessages = await this.applyHybridStrategy(compressedMessages, options);
        break;
      default:
        throw new Error(`Unknown strategy: ${options.strategy}`);
    }

    const compressedTokenCount = estimateTokens(compressedMessages);

    return {
      compressedConversation: {
        ...conversation,
        messages: compressedMessages,
      },
      originalTokenCount,
      compressedTokenCount,
      compressionRatio: calculateCompressionRatio(originalTokenCount, compressedTokenCount),
    };
  }

  /**
   * Hybrid strategy combining grouping, pruning, and then summarization if target not met.
   */
  private async applyHybridStrategy(messages: Message[], options: CompressionOptions): Promise<Message[]> {
    let result = [...messages];
    const target = options.targetTokens || 0;

    // 1. Semantic grouping first (lossless or near-lossless)
    result = await this.grouper.apply(result, options);
    
    if (target > 0 && estimateTokens(result) <= target) {
      return result;
    }

    // 2. Pruning (removing low-signal messages)
    result = await this.pruner.apply(result, options);

    if (target > 0 && estimateTokens(result) <= target) {
      return result;
    }

    // 3. Summarization (last resort, high compression)
    result = await this.summarizer.apply(result, options);

    return result;
  }

  private emptyResult(tokens: number): CompressionResult {
    return {
      compressedConversation: { id: 'empty', messages: [] },
      originalTokenCount: tokens,
      compressedTokenCount: 0,
      compressionRatio: 1.0,
    };
  }

  /**
   * Helper to identify "high-signal" points in the conversation
   */
  static getSignalScore(message: Message): number {
    let score = 0;
    
    // System messages are highest signal
    if (message.role === 'system') score += 100;
    
    // Assistant messages with tool calls are important
    if (message.role === 'assistant' && message.tool_call_id) score += 50;
    
    // User messages are important
    if (message.role === 'user') score += 40;
    
    // Length matters (to a point)
    score += Math.min(message.content.length / 100, 20);
    
    // Keywords
    const keywords = ['error', 'failed', 'success', 'goal', 'plan', 'important'];
    keywords.forEach(word => {
      if (message.content.toLowerCase().includes(word)) score += 5;
    });

    return score;
  }
}
