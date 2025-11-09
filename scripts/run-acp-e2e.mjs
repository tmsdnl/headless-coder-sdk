#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SERVER_PORT = process.env.ACP_PORT ?? '8000';
const SERVER_URL = process.env.ACP_BASE_URL ?? `http://localhost:${SERVER_PORT}`;

function log(...args) {
  console.log('[acp-e2e]', ...args);
}

function startServer() {
  log('starting acp-next dev server...');
  const child = spawn('npm', ['run', 'dev', '--workspace', 'apps/acp-next'], {
    stdio: 'inherit',
    env: { ...process.env, ACP_PORT: SERVER_PORT },
  });
  return child;
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${SERVER_URL}/api/acp/agents`);
      if (res.ok) {
        log('server is ready');
        return;
      }
    } catch {
      // ignore until timeout
    }
    await sleep(1000);
  }
  throw new Error('Timed out waiting for ACP server to start');
}

async function runClient() {
  log('running acp-client tests...');
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'test', '--workspace', 'apps/acp-client'], {
      stdio: 'inherit',
      env: { ...process.env, ACP_BASE_URL: SERVER_URL },
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`acp-client exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const server = startServer();
  const cleanup = () => {
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  };
  try {
    await waitForServer();
    await runClient();
    log('ACP end-to-end test succeeded');
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error('[acp-e2e] failed:', err);
  process.exit(1);
});
