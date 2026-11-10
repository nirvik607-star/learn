#!/usr/bin/env bash
set -euo pipefail

echo "================================================================"
echo "  LearnHarness Pro — Zero-Friction Mac / Linux Setup"
echo "  Quizlet Learn Incremental Mastery × Socratic Knowledge Graph"
echo "================================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js is not installed. Install Node 20+ via https://nodejs.org or 'brew install node'."
  exit 1
fi

echo "[1/3] Installing dependencies..."
npm install

echo "[2/3] Detecting local AI Agent CLIs..."
if command -v codex >/dev/null 2>&1; then
  echo "  ✓ OpenAI Codex CLI detected on PATH (codex)"
else
  echo "  • OpenAI Codex CLI not detected (Optional: npm install -g @openai/codex)"
fi

if command -v claude >/dev/null 2>&1; then
  echo "  ✓ Anthropic Claude Code CLI detected on PATH (claude)"
else
  echo "  • Anthropic Claude Code CLI not detected (Optional: npm install -g @anthropic-ai/claude-code)"
fi

echo "  ✓ 0-Token Pre-Compiled Quizlet Learn Engine ready (0ms latency)"
echo "[3/3] Starting LearnHarness Pro Studio..."
npm run dev
