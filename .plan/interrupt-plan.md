# Adapter Interrupt Implementation Plan

## Goal
Implement cancellation plumbing in Codex, Claude, and Gemini adapters so that:
- `RunOpts.signal` can abort in-flight runs.
- Each `ThreadHandle` exposes `interrupt(reason?)`.
- Streamed runs emit a `cancelled` event (or `error` with `code='interrupted'`).

---

## Step-by-step

1. **Core Types**
   - Add `signal?: AbortSignal` to `RunOpts`.
   - Extend `ThreadHandle` with `interrupt?(reason?: string)`.
   - Add `cancelled` to `CoderStreamEvent`.

2. **Codex Adapter**
   - The official Codex SDK does not expose a first-class cancellation API, so we will not rely on cooperative abort semantics.
   - Capability detection (best effort):
     - If the thread object exposes an `abort`/`stop`/`close` method, call it.
     - If `runStreamed` returns an iterator with `cancel`/`return`, invoke it.
     - If the SDK ever accepts an `AbortSignal`, pass the per-run signal through.
   - Default (expected) path: child-process isolation.
     - Launch a dedicated Node worker (via `fork`) for every `run`/`runStreamed` invocation.
     - The worker loads the Codex SDK, executes the request, and sends raw events/results over IPC.
     - Streaming: worker forwards each SDK event immediately; parent normalizes and yields.
     - Non-streaming: worker sends a single final payload that the parent maps to `RunResult`.
   - Abort path:
     - When `RunOpts.signal` or `thread.interrupt()` fires, send an `abort` IPC message to the worker.
     - If no completion within ~250 ms, send `SIGTERM` to the worker process.
     - If the worker still lives after ~1.5 s total, escalate to `SIGKILL` (or platform equivalent).
     - Streaming callers receive a `{ type: 'cancelled', provider: 'codex', ts: now(), originalItem: { reason } }` event before iteration ends; `run()` rejects with an `AbortError` (`code='interrupted'`).
   - Resource management:
     - Tear down IPC listeners and timers as soon as the worker exits or is killed.
     - Drain/close the worker’s stdio handles to avoid leaks.
     - Ignore/guard against late IPC messages after cancellation.
   - Concurrency contract: one in-flight run per thread. Maintain a small state blob with the current worker process + AbortController; reject or require interruption before starting another run.
   - Platform specifics:
     - Unix: `SIGTERM` then `SIGKILL`.
     - Windows: `child.kill('SIGTERM')` may no-op; fall back to `child.kill()` and, if needed, `taskkill` to ensure termination. Wrap this so adapter logic stays uniform.
   - Error semantics:
     - `run()` abort → reject with `AbortError` + `code='interrupted'`.
     - `runStreamed()` abort → emit `cancelled`; if emission fails, yield `error` with `code='interrupted'` before finishing.
     - Unexpected worker exit → propagate as an `error` event or thrown exception containing exit code/stderr.
   - Telemetry:
     - Include cancellation `reason` in `originalItem` when available.
     - Log lightweight lifecycle traces (spawn/abort/exit) for debugging.
   - Implementation outline:
     - Create a `codex-worker` script that receives run parameters via IPC, executes the SDK call, and posts back events/results. Listens for an abort message to stop early.
     - Parent adapter forks the worker for each call, hooks up IPC handlers, pipes events to normalized output, and wires per-run AbortControllers.
     - On abort, follow the abort → SIGTERM → SIGKILL sequence, emit `cancelled`, resolve/reject appropriately, and clean up handles.
   - Testing plan:
     - Provide a fake worker mode to simulate long-running operations and assert that `run()` rejects with `AbortError`, streaming yields `cancelled`, and no worker processes remain.
     - Smoke test on macOS/Linux + Windows to ensure termination logic behaves consistently.

3. **Claude Adapter**
   - Maintain AbortController per run; pass its signal to the Claude Agent SDK if supported.
   - Break out of the async generator when the signal fires; emit `cancelled`.
   - Implement `interrupt()` to abort the controller.

4. **Gemini Adapter**
   - For non-streaming runs: hold onto the spawned child process; on abort, send `proc.kill()` and reject with `AbortError`.
   - For streaming runs: kill the process, close readers, and emit `cancelled`.
   - Ensure temporary files/streams are cleaned up even on cancellation.

5. **Thread Interrupt Wiring**
   - Each adapter’s `createThreadHandle` stores state and exposes `interrupt()` that aborts the active controller.
   - Guard against multiple overlapping runs (interrupt should no-op if nothing is running).

6. **Docs & README**
   - Document the new `signal` option and `thread.interrupt()` helper.
   - Provide a short sample showing cancellation usage.

7. **Testing**
   - Add or update example tests to cover cancellation (if feasible) or manually validate by triggering `AbortController` in a sample script.

8. **Follow-up**
   - Consider exposing a `cancelled` reason for analytics/logging.
   - Ensure adapters flush resources (streams, temp dirs) when interrupted.
