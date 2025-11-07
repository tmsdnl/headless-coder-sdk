# Headless Coders

This workspace hosts the shared headless coder abstraction together with provider-specific adapters.

## Packages

- `@headless-coders/core` – Shared types and the `createCoder` factory.
- `@headless-coders/codex-adapter` – Adapter wrapping `@openai/codex-sdk`.
- `@headless-coders/claude-adapter` – Adapter wrapping `@anthropic-ai/claude-agent-sdk`.
- `@headless-coders/gemini-adapter` – Adapter invoking the Gemini CLI in headless mode.
- `@headless-coders/examples` – Sample usage scripts demonstrating runtime wiring.

## Basic Usage

```ts
import { createCoder } from '@headless-coders/core/factory';
import { CODER_TYPES } from '@headless-coders/core';

const coder = createCoder(CODER_TYPES.CODEX, { workingDirectory: process.cwd() });
const thread = await coder.startThread();
const result = await coder.run(thread, 'Generate a test plan for the API gateway.');
console.log(result.text);
```

## Streaming Example (Claude)

```ts
import { createCoder } from '@headless-coders/core/factory';
import { CODER_TYPES } from '@headless-coders/core';

const claude = createCoder(CODER_TYPES.CLAUDE_CODE, {
  workingDirectory: process.cwd(),
  permissionMode: 'bypassPermissions',
});
const thread = await claude.startThread();
for await (const event of claude.runStreamed(thread, 'Plan end-to-end tests')) {
  if (event.type === 'message' && event.role === 'assistant') {
    process.stdout.write(event.delta ? event.text ?? '' : `\n${event.text}\n`);
  }
}

// Later you can resume the same Claude session and continue a conversation.
const resumed = await claude.resumeThread(thread.id!);
const followUp = await claude.run(resumed, 'Summarise the agreed test plan.');
console.log(followUp.text);
```

## Structured Output Example (Gemini)

```ts
import { createCoder } from '@headless-coders/core/factory';
import { CODER_TYPES } from '@headless-coders/core';

const gemini = createCoder(CODER_TYPES.GEMINI, {
  workingDirectory: process.cwd(),
  includeDirectories: [process.cwd()],
});

const turn = await gemini.run(
  await gemini.startThread(),
  'Summarise the repo in JSON',
  {
    outputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        components: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['summary', 'components'],
    },
  },
);

console.log(turn.json); // Parsed object based on the schema above

// Gemini CLI resume support is pending (https://github.com/google-gemini/gemini-cli/pull/10719).
// Once merged upstream, a resume example will be added here.

## Resume Example (Codex)

```ts
import { createCoder } from '@headless-coders/core/factory';
import { CODER_TYPES } from '@headless-coders/core';

const codex = createCoder(CODER_TYPES.CODEX, {
  workingDirectory: process.cwd(),
  sandboxMode: 'workspace-write',
  skipGitRepoCheck: true,
});

const session = await codex.startThread({ model: 'gpt-5-codex' });
await codex.run(session, 'Draft a CLI plan.');

// pause... later
const resumedSession = await codex.resumeThread(session.id!);
const followUp = await codex.run(resumedSession, 'Continue with implementation details.');
console.log(followUp.text);
```
```

## Development

- Install dependencies with your preferred package manager:
  - `npm install`
  - or `pnpm install`
- Run workspace builds: `npm run build` or `pnpm run build`
- Execute tests across packages: `npm run test` or `pnpm run test`
