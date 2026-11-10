# ApexLearn Harness — Agent Instructions (OpenAI Codex, Claude Code, Cursor)

Welcome! This repository is **ApexLearn Harness**, a reverse-engineered, token-optimized evolution of **LearnHarness** combined with **Quizlet Learn** incremental mastery, **Unit & Overall Exam Readiness Scoring (0–100% A+ Predictor)**, and cognitive science workflows from 7 evidence-based learning systems.

When a student or developer opens this repository in **OpenAI Codex (macOS app or CLI)**, **Claude Code**, or any coding agent, follow this playbook.

---

## 1. Zero-Friction Quickstart (Mac / Linux / Windows)

If the user says **"set this up"**, **"start the app"**, or **"help me study"**:

1. Ensure dependencies are installed and start the local server (which includes both the ultra-fast Vite UI and the local Multi-Auth AI Bridge for Codex CLI, Claude Code CLI, ChatGPT OAuth, and API keys):
   ```bash
   npm install && npm run dev
   ```
2. Tell the user to open `http://localhost:5173` (or run `open http://localhost:5173` on macOS).
3. The local bridge server automatically detects if `codex` (OpenAI Codex CLI) or `claude` (Anthropic Claude Code CLI) is installed on their Mac—meaning **zero API keys are required** if they already use Codex or Claude Code!

---

## 2. "Compile Once, Study at 0 Tokens" Workflow (Adding a New Exam / Course)

This harness uses a **Hybrid Compile-Once Engine** so that 80–95% of study interactions (Quizlet Learn rounds, MCQ recognition, near-twin discrimination, chain ordering, spaced repetition, and readiness calculation) run locally at **0ms latency and 0 token cost**.

When the user drops lecture notes, syllabi, slides, or practice exams into `imports/` (or pastes them in chat) and asks you to **create a study set / course pack**:

1. Read their material thoroughly.
2. Deconstruct the material into **Units** and a **Prerequisite Knowledge Graph** of **Propositions** (`nodes`) and **Reasoning Chains** (`edges`), following the two foundational principles:
   - **Principle i (Unconditional Truths First)**: Identify the bedrock, caveat-free facts (`isUnconditionalTruth: true`) that everything else derives from. Rank each node by its **Generator Yield (`examWeight`: 1–5)**—how many downstream exam questions depend on it (80/20 Pareto rule).
   - **Principle ii ("How Could I Have Discovered This?" Motivated Derivations)**: Never present formulas or rules as arbitrary decrees. Include a `motivatedHook` ("What problem forces us to invent this?") and a `predictionPrompt` ("Before seeing the rule, what do you think happens when...?").
3. For **every proposition node**, generate all **4 Quizlet Learn Incremental Stages**:
   - **Stage 0 (`priming`)**: High-level 80/20 mental hook + prediction question (`type: "predict"`).
   - **Stage 1 (`recognition` - Familiar)**: Diagnostic Multiple-Choice question where **every distractor maps to a named misconception** (`distractorDiagnostics`), plus a **Near-Twin Discrimination** question (`discriminationPrompt`).
   - **Stage 2 (`cued_recall` - Learned)**: Active recall fill-in / key-term / step-ordering prompt with accepted keywords and a 6-rung minimal hint ladder (`R0` attention redirect -> `R5` worked step).
   - **Stage 3 (`application` - Mastered / Exam-Level)**: Unaided free-response / multi-step derivation / Feynman "Explain like I'm 10" prompt with a frozen grading rubric (`requiredMoves`, `commonTraps`, `modelSolution`).
4. Write the compiled course JSON into `public/courses/<course-slug>.json` and register it in `public/courses/index.json` (or `src/data/defaultCourses.ts`).

---

## 3. Core Pedagogical Laws (When Tutoring Live in Chat or via Bridge)

1. **Probe -> Plan -> Teach -> Practice**:
   - **Probe**: Binary-search strands starting near the top (hardest prerequisite) to bracket the learner's floor (what feels obviously true) and ceiling (where understanding breaks).
   - **Plan**: Build the **minimal dependency tree**—prune what they already hold, skip tangents, and order from unconditional truths to derived conclusions.
   - **Teach**: Move **one reasoning step at a time** (`predict -> teach -> check`). Never lecture across 3 steps without checking each landing.
   - **Practice**: Respect the **Inactivity Constraint**—interleave topics so the learner must retrieve *which* concept applies cold.
2. **6-Rung Hint Ladder (Never Spoil What the Learner Can Generate)**:
   - `R0`: Attention redirect ("Re-read the second constraint.")
   - `R1`: Pattern re-description ("Look at the rate of change as $t \to \infty$.")
   - `R2`: Candidate cluster ("One of the conservation laws applies here.")
   - `R3`: Named proposition ("Apply Bayes' rule to the conditional probability.")
   - `R4`: Move outline ("Expand the denominator into true positives + false positives.")
   - `R5`: Worked step.
3. **Mistake Classification**:
   - Every miss must be classified as `cue_miss`, `discrimination_error`, `execution_slip`, `careless`, or `structural_misconception` and logged to the Mistake Notebook for interleaved re-testing in a fresh surface.
