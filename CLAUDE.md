# CLAUDE.md — Anthropic Claude Code Instructions for ApexLearn Harness

This repository is engineered so both **Claude Code (`claude`)** and **OpenAI Codex (`codex`)** can set it up, compile college exam courses, or run live Socratic tutoring sessions in seconds.

Read [`AGENTS.md`](./AGENTS.md) and [`skills/learn-harness/SKILL.md`](./skills/learn-harness/SKILL.md) for the complete pedagogical specification, JSON schemas, and zero-token course compilation workflow.

## Commands
- `npm run dev` — Starts the Vite frontend (`http://localhost:5173`) + built-in Local AI Bridge (`Claude Code CLI`, `Codex CLI`, `OpenAI ChatGPT OAuth`, `OpenAI/Anthropic API keys`).
- `npm run build` — Builds the production web app / static PWA bundle (`dist/`) for instant zero-install sharing.
- `npm test` — Runs the deterministic test suite for the Readiness Score Engine, Quizlet Learn Adaptive Scheduler, and Mistake Classifier.
- `node scripts/compile-course.mjs <input-file-or-topic>` — Uses your installed `codex` or `claude` CLI (or API key) to compile raw notes/syllabi into a 0-token interactive course pack.
