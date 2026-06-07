# Agent Context Compressor

A specialized tool for semantically compressing AI agent conversation history into a minimal context window using advanced summarization, pruning, and grouping strategies.

## Overview

Large context windows are expensive and often filled with redundant or low-signal information. `agent-context-compressor` provides a systematic way to reduce the token footprint of long conversations while preserving the critical semantic "soul" of the interaction.

## Features

- **Multi-Strategy Compression**:
  - **Summarization**: Uses LLM-driven synthesis to collapse large message blocks.
  - **Pruning**: Identifies and removes low-signal messages (filler, redundant confirmations).
  - **Grouping**: Merges adjacent messages from the same role into conceptual turns.
  - **Hybrid**: Intelligently combines all strategies to meet a specific token target.
- **Signal Scoring**: Heuristic-based importance ranking of messages.
- **Token Estimation**: Built-in utilities for tracking context usage.
- **Tool-Call Awareness**: Special handling for sequences of tool interactions to ensure logic flow is preserved.

## Installation

```bash
bun add agent-context-compressor
```

## Usage

```typescript
import { AgentContextCompressor } from 'agent-context-compressor';

const compressor = new AgentContextCompressor();

const conversation = {
  id: 'conv_123',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Help me debug this code...' },
    // ... many more messages
  ]
};

const result = await compressor.compress(conversation, {
  strategy: 'hybrid',
  targetTokens: 2000,
  preserveSystemMessages: true
});

console.log(`Original: ${result.originalTokenCount} tokens`);
console.log(`Compressed: ${result.compressedTokenCount} tokens`);
console.log(`Ratio: ${result.compressionRatio * 100}%`);
```

## Compression Strategies

### Pruning
The pruning strategy ranks messages based on a "signal score" influenced by role, recency, complexity, and keyword presence. It removes the lowest-ranked messages first until the target token count is reached.

### Grouping
The grouping strategy merges consecutive messages from the same role. It also identifies tool-call sequences and collapses them into a summary block if they exceed a certain threshold, preventing "tool-log bloat".

### Summarization
The summarization strategy chunks the conversation and generates high-level summaries. It is the most aggressive compression method and is typically used as a last resort in hybrid mode.

## Architecture

The project is structured into modular strategies:
- `src/strategies/`: Individual logic for each compression method.
- `src/compressor.ts`: Main orchestration layer.
- `src/utils.ts`: Token counting and validation helpers.

## License

MIT
