import { Message, CompressionOptions } from '../types';

export class GroupingStrategy {
  /**
   * Groups adjacent messages from the same role if they are conceptually linked.
   */
  async apply(messages: Message[], options: CompressionOptions): Promise<Message[]> {
    if (messages.length <= 1) return messages;

    const grouped: Message[] = [];
    let current: Message | null = null;

    for (const msg of messages) {
      if (!current) {
        current = { ...msg };
        continue;
      }

      // If roles match and it's not a tool call sequence, we can potentially merge
      if (current.role === msg.role && !current.tool_call_id && !msg.tool_call_id) {
        // Only merge if total content doesn't become too massive (heuristic)
        if (current.content.length + msg.content.length < 5000) {
          current.content += `\n\n${msg.content}`;
          // Merge metadata if present
          if (msg.metadata) {
            current.metadata = { ...current.metadata, ...msg.metadata };
          }
          continue;
        }
      }

      grouped.push(current);
      current = { ...msg };
    }

    if (current) {
      grouped.push(current);
    }

    return this.postProcess(grouped);
  }

  /**
   * Collapses tool call sequences if they are redundant or too verbose.
   */
  private postProcess(messages: Message[]): Message[] {
    // Logic to collapse multiple small tool outputs into one summary block
    const result: Message[] = [];
    let toolBuffer: Message[] = [];

    for (const msg of messages) {
      if (msg.role === 'tool') {
        toolBuffer.push(msg);
      } else {
        if (toolBuffer.length > 3) {
          result.push(this.summarizeToolCalls(toolBuffer));
        } else {
          result.push(...toolBuffer);
        }
        toolBuffer = [];
        result.push(msg);
      }
    }

    if (toolBuffer.length > 0) {
      if (toolBuffer.length > 3) {
        result.push(this.summarizeToolCalls(toolBuffer));
      } else {
        result.push(...toolBuffer);
      }
    }

    return result;
  }

  private summarizeToolCalls(calls: Message[]): Message {
    const summary = calls.map(c => `[Tool: ${c.name || 'unknown'}] -> ${c.content.substring(0, 50)}...`).join('\n');
    return {
      role: 'tool',
      content: `Summary of ${calls.length} tool calls:\n${summary}`,
      metadata: { originalCount: calls.length, collapsed: true }
    };
  }

  /**
   * Detects and groups turns (User -> Assistant) into single conceptual units.
   */
  static identifyTurns(messages: Message[]): Message[][] {
    const turns: Message[][] = [];
    let currentTurn: Message[] = [];

    for (const msg of messages) {
      if (msg.role === 'user' && currentTurn.length > 0) {
        turns.push(currentTurn);
        currentTurn = [msg];
      } else {
        currentTurn.push(msg);
      }
    }

    if (currentTurn.length > 0) {
      turns.push(currentTurn);
    }

    return turns;
  }
}
