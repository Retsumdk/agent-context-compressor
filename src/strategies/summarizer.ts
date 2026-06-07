import { Message, CompressionOptions } from '../types';
import { estimateTokens, chunkMessages } from '../utils';

export class SummarizationStrategy {
  constructor(private apiKey?: string) {}

  /**
   * Summarizes message history. In a real implementation, this would call an LLM.
   * Here we implement the logic for chunking and prompt generation.
   */
  async apply(messages: Message[], options: CompressionOptions): Promise<Message[]> {
    const target = options.targetTokens || 0;
    const currentTokens = estimateTokens(messages);

    if (target === 0 || currentTokens <= target) {
      return messages;
    }

    // Identify system messages to preserve
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // Chunk the non-system messages
    const chunks = chunkMessages(nonSystemMessages, 4000);
    const summaries: string[] = [];

    for (const chunk of chunks) {
      const chunkText = chunk.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      
      // Simulate LLM call
      const summary = await this.mockSummarizeCall(chunkText, options);
      summaries.push(summary);
    }

    // Combine summaries into a single message or set of messages
    const finalSummaryContent = summaries.length > 1 
      ? `Summary of previous conversation history:\n\n${summaries.join('\n\n---\n\n')}`
      : summaries[0];

    return [
      ...systemMessages,
      {
        role: 'system',
        content: `CONTEXT_SUMMARY: ${finalSummaryContent}`,
        metadata: { summarized: true, originalTokens: currentTokens }
      },
      // Keep the last few messages for immediate context if they weren't part of the summary
      ...nonSystemMessages.slice(-2)
    ];
  }

  /**
   * Generates a prompt for the summarization task.
   */
  private generatePrompt(text: string, options: CompressionOptions): string {
    return `
      Compress the following conversation history into a concise summary.
      Focus on key decisions, technical findings, and stated goals.
      Exclude greetings, minor errors that were corrected, and redundant small talk.
      Target length: approximately ${options.targetTokens ? Math.floor(options.targetTokens / 2) : 500} words.
      
      Conversation:
      ${text}
    `.trim();
  }

  /**
   * Mock implementation of an LLM call for summarization.
   */
  private async mockSummarizeCall(text: string, options: CompressionOptions): Promise<string> {
    // In a production environment, this would call process.env.ZO_API_KEY or similar
    // For this implementation, we'll simulate the "compression" by extracting key sentences
    // or providing a structured mock response.
    
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const importantLines = lines.filter(l => 
      l.includes('goal') || 
      l.includes('result') || 
      l.includes('fix') || 
      l.includes('error') || 
      l.length > 100
    );

    if (importantLines.length === 0) {
      return "The conversation focused on general coordination and minor updates.";
    }

    return `Discussion points included: ${importantLines.slice(0, 5).map(l => l.replace(/^[A-Z]+: /, '').trim()).join('; ')}.`;
  }

  /**
   * Refines a summary recursively if it's still too large.
   */
  async recursiveSummarize(text: string, targetTokens: number): Promise<string> {
    let current = text;
    let iterations = 0;
    
    while (estimateTokens([{ role: 'system', content: current }]) > targetTokens && iterations < 3) {
      current = await this.mockSummarizeCall(current, { strategy: 'summarize', targetTokens });
      iterations++;
    }
    
    return current;
  }
}
