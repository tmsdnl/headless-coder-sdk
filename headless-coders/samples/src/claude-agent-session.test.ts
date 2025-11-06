/**
 * @fileoverview Validates Claude Agent SDK integration through the shared headless coder facade.
 *
 * The test sends a lightweight planning prompt and ensures Claude returns a non-empty response.
 */

import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import { createCoder } from '@headless-coders/core/factory';
import type { PromptInput, RunResult } from '@headless-coders/core/types';

const CLAUDE_WORKSPACE = process.env.CLAUDE_TEST_WORKSPACE ?? '/tmp/headless-coder/test_claude';
const CLAUDE_TIMEOUT_MS = Number.parseInt(process.env.CLAUDE_TEST_TIMEOUT_MS ?? '', 10) || 180_000;

/**
 * Ensures the Claude working directory exists without mutating user-provided settings.
 *
 * Args:
 *   dir: Absolute path to the workspace that should exist for the test run.
 *
 * Returns:
 *   Promise that resolves once the workspace directory is present.
 *
 * Raises:
 *   Error: Propagated if the directory cannot be created.
 */
async function ensureWorkspace(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Builds a prompt that asks Claude to enumerate validation steps for a calculator feature.
 *
 * Args:
 *   workspace: The working directory Claude can read/write within.
 *
 * Returns:
 *   PromptInput requesting a concise validation checklist.
 */
function buildPrompt(workspace: string): PromptInput {
  return [
    {
      role: 'system',
      content: `You are assisting with integration tests located in ${workspace}.`,
    },
    {
      role: 'user',
      content:
        'Provide three concise bullet points that describe how to manually verify the generated web calculator works as expected.',
    },
  ];
}

/**
 * Wraps a promise with an upper bound on completion time.
 *
 * Args:
 *   promise: The promise to monitor.
 *   timeoutMs: Milliseconds before rejecting with a timeout error.
 *   message: Error message used when the timeout elapses.
 *
 * Returns:
 *   The fulfilled promise value when completed before timeout.
 *
 * Raises:
 *   Error: When the underlying promise rejects or when the timeout is exceeded.
 */
async function withinTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * Executes the Claude planning scenario and validates the returned response.
 *
 * Args:
 *   t: Node.js test context used for cleanup registration.
 *
 * Returns:
 *   Promise that resolves once validation completes.
 *
 * Raises:
 *   Error: When prerequisites are missing or Claude fails to respond.
 */
async function runClaudeScenario(t: TestContext): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
    t.skip(
      'Skipping Claude integration test because ANTHROPIC_API_KEY or CLAUDE_API_KEY is not configured.',
    );
    return;
  }

  await ensureWorkspace(CLAUDE_WORKSPACE);

  const coder = createCoder('claude', {
    workingDirectory: CLAUDE_WORKSPACE,
    model: process.env.CLAUDE_TEST_MODEL,
    continue: true,
  });
  const thread = await coder.startThread();

  const registerCleanup = (t as { cleanup?: (fn: () => Promise<void> | void) => void }).cleanup;
  if (typeof registerCleanup === 'function') {
    registerCleanup(async () => {
      await coder.close?.(thread);
    });
  } else {
    t.signal.addEventListener('abort', () => {
      void coder.close?.(thread);
    });
  }

  const result = await withinTimeout<RunResult>(
    coder.run(thread, buildPrompt(CLAUDE_WORKSPACE), { streamPartialMessages: true }),
    CLAUDE_TIMEOUT_MS,
    `Claude integration test timed out after ${CLAUDE_TIMEOUT_MS}ms.`,
  );

  assert.ok(result.text && result.text.trim().length > 0, 'Claude should return a non-empty reply.');
  if (typeof thread.id === 'string') {
    assert.equal(
      result.threadId,
      thread.id,
      'Claude run should report the same thread identifier that was started.',
    );
  }
}

test('claude agent produces a verification plan', runClaudeScenario);
