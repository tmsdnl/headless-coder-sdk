# Changelog

## [0.1.0] - 2025-11-08
### 🎉 First Public Release

This is the first public release of **Headless Coder SDK**, an open-source framework that unifies multiple headless AI-coder SDKs — **OpenAI Codex**, **Anthropic Claude Agent SDK**, and **Google Gemini CLI (headless)** — under one consistent developer interface.

### 🚀 Highlights
- Unified `createCoder()` and thread API across Codex, Claude, and Gemini.
- Standardized streaming via `runStreamed()` and structured output via `outputSchema`.
- Shared permission + sandbox model (`read-only`, `workspace-write`, `danger-full-access`).
- Thread resume support for Codex and Claude adapters.
- Cooperative cancellation using `RunOpts.signal` or `thread.interrupt()`.
- Modular adapter registration pattern:
  ```ts
  registerAdapter(CODEX_CODER, createCodexAdapter);
  ```
- Initial permission and sandbox enforcement layer.
- Example suite for multi-provider workflows and structured output validation.

### 📦 Packages included
- `@headless-coder-sdk/core`  
- `@headless-coder-sdk/codex-adapter`  
- `@headless-coder-sdk/claude-adapter`  
- `@headless-coder-sdk/gemini-adapter`  
- `@headless-coder-sdk/examples`

### 🧩 Developer Docs
- [README](https://github.com/OhadAssulin/headless-coder-sdk#readme)
- [Create Your Own Adapter guide](https://github.com/OhadAssulin/headless-coder-sdk/blob/main/docs/create-your-own-adapter.md)

### 🧠 Notes
This release establishes the unified adapter interface, event model, and sandboxing foundation for future integrations and features — such as structured streaming, granular permissions, and new AI-coder backends.

---

_© 2025 Ohad Assulin — MIT License_
