/**
 * @fileoverview Factory helpers for creating headless-coder-sdk adapters.
 */

import { CodexAdapter } from '@headless-coder-sdk/codex-adapter';
import { ClaudeAdapter } from '@headless-coder-sdk/claude-adapter';
import { GeminiAdapter } from '@headless-coder-sdk/gemini-adapter';
import type { Provider, StartOpts, HeadlessCoderSdk } from './types.js';

/**
 * Creates a provider-specific headless-coder-sdk instance.
 *
 * @param provider Provider identifier.
 * @param defaults Default start options injected into the adapter.
 * @returns Provider-specific `HeadlessCoderSdk` implementation.
 */
export function createCoder(provider: Provider, defaults?: StartOpts): HeadlessCoderSdk {
  switch (provider) {
    case 'codex':
      return new CodexAdapter(defaults);
    case 'claude':
      return new ClaudeAdapter(defaults);
    case 'gemini':
      return new GeminiAdapter(defaults);
    default: {
      const exhaustiveCheck: never = provider;
      throw new Error(`Unsupported provider: ${exhaustiveCheck}`);
    }
  }
}
