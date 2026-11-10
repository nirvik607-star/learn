# LearnHarness Pro — Cognitive Exam Mastery & Socratic Knowledge Graph

**LearnHarness Pro** reverse-engineers and upgrades the [LearnHarness](https://github.com/amosblomqvist/learnharness) agentic learning architecture (`Probe → Plan → Teach → Practice` over a persistent prerequisite knowledge graph) and fuses it with **Quizlet Learn-style 4-stage incremental mastery**, **Unit & Overall Exam Readiness Scores (`0–100%` A/A+ Predictor)**, **FSRS/Ebbinghaus Spaced Repetition Decay**, and a **"Compile Once, Study Fast (0-Token)"** hybrid engine.

Built for effortless sharing with college classmates: works out of the box in any browser at **0ms latency and 0 token cost** for 80–95% of study sessions, while automatically detecting **OpenAI Codex CLI (`codex` on Mac/Linux)**, **Anthropic Claude Code CLI (`claude`)**, **OpenAI ChatGPT Interactive PKCE OAuth (`auth.openai.com`)**, **OpenAI / Anthropic API keys**, or **Local Ollama** for live Socratic interrogation.

---

## 1-Command Setup (Mac / Linux / OpenAI Codex / Claude Code)

```bash
git clone https://github.com/nirvik607-star/learn.git
cd learn
chmod +x scripts/mac-codex-setup.sh
./scripts/mac-codex-setup.sh
```

Or simply open **OpenAI Codex** or **Claude Code** on your Mac and prompt:
> *"Read `AGENTS.md`, install dependencies, and start the LearnHarness Pro server."*

---

## How the 7 Cognitive Science Videos & LearnHarness Are Integrated

| Source / Principle | What We Built into LearnHarness Pro |
| :--- | :--- |
| **1. LearnHarness (`@EeroAlvar` / Amos Blomqvist)**<br>`youtube.com/watch?v=nfTDljFG2g0` | **Two-Principle Prerequisite DAG**: Separates **Principle (i) Unconditional Truths** from **Principle (ii) Motivated Derivations** (no unmotivated steps). Implements **Diagnostic Binary-Search Probing** (`floor_held` vs `edge_target`), `Predict → Teach → Check` with collapsed reveal gates, **Thinking Fields**, and the **R0–R5 Minimal Hint Ladder**. |
| **2. Quizlet Learn Incremental Progression** | **4-Stage Mastery Pipeline**: Every proposition progresses through `Stage 0 (Unseen — Priming & Prediction)` → `Stage 1 (Familiar — Recognition & Near-Twin Discrimination)` → `Stage 2 (Learned — Cued Active Recall)` → `Stage 3 (Mastered — Unaided Exam Application & Multi-Premise Composition)`. |
| **3. 80/20 Pareto Deconstruction (`@OlderBrother_`)**<br>`youtube.com/watch?v=hCSHuvDejGA` | **80/20 Generator Weighting**: Foundational nodes that unlock multiple downstream derivations carry `1.8x–2.0x` weight in the Exam Readiness formula and are prioritized first in adaptive sprints. |
| **4. Active Hypothesis Before Options (`@EvolvingMedic`)**<br>`youtube.com/watch?v=1OO8j3lz-i8` | **"Cover Options First" Mode**: During Stage 1 MCQ questions, learners can formulate their own hypothesis before revealing the 4 options so they aren't seduced by plausible near-twin distractors. |
| **5. Mistake Notebook & Strict Examiner** (`youtube.com/watch?v=9tDkkKDQWlg`) | **Automatic "Screw-Up Log" + Strict Examiner Persona**: Every miss or R3+ hint automatically logs a `MistakeRecord` classified by failure type (`discrimination_error`, `cue_miss`, `structural_misconception`, `execution_slip`, `careless`) and forces a fresh-surface repair test at the end of the round. |
| **6. Interleaving, Spaced Consolidation & NSDR** (`youtube.com/watch?v=TjPFZaMe2yw` & `HZHbHL0dbnw`) | **FSRS/Ebbinghaus Retrievability ($R(t) = 2^{-\Delta t / S}$)**: Tracks memory stability half-life $S$ per proposition, includes a **+24h / +48h / +7d Exam-Day Decay Simulator**, and embeds a **25m Focus / 2m NSDR Consolidation Timer** in the top bar. |
| **7. 1-Page Pre-Exam Cram & Confidence Regulation** (`@MatthewSmith33`, `youtube.com/watch?v=vQsVhbVEbSU`) | **1-Page 80/20 Cram Sheet**: Synthesizes all Unconditional Truths, Governing Equations, and Exam Trap Guardrails on a single calm page with data-backed readiness verification. |

---

## Unit & Overall Exam Readiness Score (`0–100%` A+ Predictor)

Each proposition node $i$ has a live readiness score $r_i \in [0, 100]$:

$$\text{Readiness}_i = 100 \times \left(0.62 \cdot M(\text{tier}_i) \cdot R_i(t) + 0.23 \cdot U_i + 0.15 \cdot C_i\right)$$

- $M(\text{tier}_i) \in \{0.0, 0.38, 0.76, 1.0\}$: Quizlet Learn mastery stage multiplier.
- $R_i(t) = 2^{-\Delta t / S_i}$: Ebbinghaus/FSRS spaced-repetition retrievability at time $t$.
- $U_i$: Unaided accuracy bonus (solving at `R0` without hints).
- $C_i$: Metacognitive confidence calibration score (penalizing high-confidence blind spots).
- **90–100% (`A / A+ Ready`)**: Every 80/20 Pareto generator and derived proposition is verified under unaided recall with strong retention stability.

---

## Multi-Auth Architecture & Insane Speed (`server/aiBridgePlugin.ts`)

1. **0-Token Pre-Compiled Engine (Default, 0ms Latency)**:
   - Course packs contain pre-compiled Stage 0–3 prompts, near-twin distractors, rubric keywords, and R0–R5 hints.
   - 80–95% of study sessions use **zero API calls** and run instantaneously offline or online.
2. **OpenAI Codex CLI (`codex`)**:
   - Automatically detected if `codex` is installed on your Mac/Linux machine (`codex exec`).
3. **Anthropic Claude Code CLI (`claude`)**:
   - Automatically detected if `claude` is installed (`claude -p`).
4. **OpenAI ChatGPT Interactive PKCE OAuth (`auth.openai.com`)**:
   - Built-in PKCE OAuth flow (`POST /api/ai/oauth/chatgpt/start`) modeled after LearnHarness's desktop OAuth bridge.
5. **OpenAI / Anthropic API Keys & Local Ollama**:
   - Supports `OPENAI_API_KEY` (`gpt-4o-mini`), `ANTHROPIC_API_KEY` (`claude-3-5-haiku` with ephemeral prompt caching), or local Ollama (`http://localhost:11434/v1/chat/completions`).
