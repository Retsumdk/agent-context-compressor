import { Message, CompressionOptions } from '../types';
import { estimateTokens } from '../utils';

export class PruningStrategy {
  /**
   * Prunes low-signal messages to meet target token count.
   */
  async apply(messages: Message[], options: CompressionOptions): Promise<Message[]> {
    const target = options.targetTokens || 0;
    const currentTokens = estimateTokens(messages);

    if (target === 0 || currentTokens <= target) {
      return messages;
    }

    // Assign signal scores to each message
    const scoredMessages = messages.map((msg, index) => ({
      msg,
      index,
      score: this.calculateSignalScore(msg, index, messages.length),
    }));

    // Sort by score descending, then by index to preserve order
    scoredMessages.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

    const preserved: typeof scoredMessages = [];
    let preservedTokens = 0;
    const minToKeep = options.minMessagesToKeep || 3;

    // Always keep system messages if requested
    if (options.preserveSystemMessages !== false) {
      for (let i = scoredMessages.length - 1; i >= 0; i--) {
        if (scoredMessages[i].msg.role === 'system') {
          preserved.push(scoredMessages[i]);
          preservedTokens += estimateTokens([scoredMessages[i].msg]);
          scoredMessages.splice(i, 1);
        }
      }
    }

    // Keep the rest until target or min count reached
    for (const sm of scoredMessages) {
      const tokens = estimateTokens([sm.msg]);
      if (preservedTokens + tokens <= target || preserved.length < minToKeep) {
        preserved.push(sm);
        preservedTokens += tokens;
      }
    }

    // Re-sort by original index
    return preserved.sort((a, b) => a.index - b.index).map(sm => sm.msg);
  }

  private calculateSignalScore(msg: Message, index: number, total: number): number {
    let score = 0;

    // Role-based scoring
    switch (msg.role) {
      case 'system': score += 100; break;
      case 'user': score += 50; break;
      case 'assistant': score += 40; break;
      case 'tool': score += 30; break;
    }

    // Recency bias (newer messages are usually more relevant)
    const recencyFactor = (index / total) * 30;
    score += recencyFactor;

    // Content length contribution (very short messages like "ok" are low signal)
    if (msg.content.length > 10) score += 10;
    if (msg.content.length > 100) score += 10;

    // Tool call importance
    if (msg.tool_call_id) score += 20;

    // Complexity heuristic (presence of code, JSON, or lists)
    if (msg.content.includes('```')) score += 15;
    if (msg.content.includes('{') && msg.content.includes('}')) score += 10;
    if (msg.content.includes('\n- ') || msg.content.includes('\n* ')) score += 10;

    return score;
  }

  /**
   * Filters out messages that are purely decorative or conversational filler.
   */
  static filterFiller(messages: Message[]): Message[] {
    const fillerPatterns = [
      /^(ok|okay|got it|thanks|thank you|no problem|understood)\.?$/i,
      /^hello/i,
      /^hi there/i,
    ];

    return messages.filter(msg => {
      if (msg.role === 'system') return true;
      const content = msg.content.trim();
      return !fillerPatterns.some(pattern => pattern.test(content));
    });
  }
}
