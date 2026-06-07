import { describe, it, expect, beforeEach } from 'bun:test';
import { AgentContextCompressor } from '../src/compressor';
import { Conversation, Message } from '../src/types';
import { estimateTokens } from '../src/utils';

describe('AgentContextCompressor', () => {
  let compressor: AgentContextCompressor;

  beforeEach(() => {
    compressor = new AgentContextCompressor();
  });

  const mockMessages: Message[] = [
    { role: 'system', content: 'You are an AI.' },
    { role: 'user', content: 'Hello, I have a problem with my code.' },
    { role: 'assistant', content: 'I can help. What is the error?' },
    { role: 'user', content: 'It says "Index out of bounds".' },
    { role: 'assistant', content: 'That usually happens when you access an array incorrectly.' },
    { role: 'user', content: 'Thanks, I fixed it.' },
    { role: 'assistant', content: 'Great! Is there anything else?' },
  ];

  const mockConversation: Conversation = {
    id: 'test-1',
    messages: mockMessages,
  };

  it('should estimate tokens correctly', () => {
    const tokens = estimateTokens(mockMessages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should prune messages when target is low', async () => {
    const result = await compressor.compress(mockConversation, {
      strategy: 'prune',
      targetTokens: 20,
    });

    expect(result.compressedTokenCount).toBeLessThanOrEqual(result.originalTokenCount);
    expect(result.compressedConversation.messages.length).toBeLessThan(mockMessages.length);
    // Should preserve system message by default
    expect(result.compressedConversation.messages[0].role).toBe('system');
  });

  it('should group adjacent messages', async () => {
    const doubleUserMessages: Message[] = [
      { role: 'user', content: 'Part 1' },
      { role: 'user', content: 'Part 2' },
      { role: 'assistant', content: 'Response' },
    ];
    
    const result = await compressor.compress({ id: 'test-2', messages: doubleUserMessages }, {
      strategy: 'group',
    });

    expect(result.compressedConversation.messages.length).toBe(2);
    expect(result.compressedConversation.messages[0].content).toContain('Part 1');
    expect(result.compressedConversation.messages[0].content).toContain('Part 2');
  });

  it('should apply hybrid strategy correctly', async () => {
    const result = await compressor.compress(mockConversation, {
      strategy: 'hybrid',
      targetTokens: 30,
    });

    // The mock summarizer might not hit the target exactly, but it should definitely be less than original
    expect(result.compressedTokenCount).toBeLessThan(result.originalTokenCount);
    expect(result.compressionRatio).toBeGreaterThan(0);
  });

  it('should calculate signal scores', () => {
    const systemScore = AgentContextCompressor.getSignalScore({ role: 'system', content: 'important' });
    const userScore = AgentContextCompressor.getSignalScore({ role: 'user', content: 'hi' });
    
    expect(systemScore).toBeGreaterThan(userScore);
  });
});
