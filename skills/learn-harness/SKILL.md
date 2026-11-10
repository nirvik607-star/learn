---
name: learn-harness
description: Compile lecture notes, syllabi, or topics into token-optimized Quizlet Learn + LearnHarness course packs, or run interactive Probe-Plan-Teach-Practice tutoring and Readiness analysis.
---

# ApexLearn Harness Skill (`learn-harness`)

Use this skill whenever the user wants to:
1. **Compile study materials** (PDFs, markdown notes, slides, past exams, or topic names) into an interactive course pack inside `public/courses/` or `src/data/defaultCourses.ts`.
2. **Run a Socratic Probe / Plan / Teach / Practice session** directly in the terminal/chat or through the web UI.
3. **Audit their Exam Readiness Score (0–100%)** and Mistake Notebook across units.

## 1. The 7-Video Evidence-Based Learning Stack

Every course pack and tutoring session combines seven mechanisms:
1. **LearnHarness Structural Graph (`nfTDljFG2g0`)**: Propositions as nodes, joint-premise derivations as edges. Distinguish **Principle i (Unconditional Truths)** from **Principle ii (Motivated Discoveries — "How could I have discovered this?")**.
2. **Quizlet Learn 4-Stage Mastery Progression**:
   - Stage 0: **Priming & Prediction** (80/20 hook + `predict` move before explanation)
   - Stage 1: **Familiar (Recognition & Discrimination)** (MCQ with misconception-mapped distractors + near-twin discrimination)
   - Stage 2: **Learned (Cued Active Recall)** (Active retrieval + Thinking Field + Confidence Slider)
   - Stage 3: **Mastered (Exam-Level Application & Composition)** (Unaided multi-step problem or Feynman explanation with R0–R5 minimal hints)
3. **TED-Ed Brain Consolidation (`TjPFZaMe2yw`)**: Active recall + mandatory topic interleaving (satisfying the Inactivity Constraint) + Ebbinghaus/FSRS spaced-repetition decay tracking ($R(t) = 2^{-\Delta t / S}$).
4. **Priming & NSDR Focus Pacing (`HZHbHL0dbnw`)**: Pre-study 80/20 structural priming map + focused study sprints with 2-minute NSDR (Non-Sleep Deep Rest) consolidation breaks.
5. **Mistake Notebook & Strict Examiner (`9tDkkKDQWlg`)**: Automatic error logging classified by failure mode (`cue_miss`, `discrimination_error`, `execution_slip`, `careless`, `structural_misconception`) + "Strict/Angry Examiner" Feynman drill mode.
6. **Active Hypothesis Before Options (`1OO8j3lz-i8`)**: Option to lock in your own hypothesis in the Thinking Field before revealing multiple-choice options, preventing familiarity illusions.
7. **Pre-Exam Cram Sheet & Confidence Calibration (`vQsVhbVEbSU` & `hCSHuvDejGA`)**: 80/20 high-yield generator ranking + 1-page last-minute solidification view + Unit & Overall Readiness Score (0–100%, where 90–100% predicts an A/A+ exam grade).

## 2. Course Pack JSON Schema

When generating a new course pack, save it to `public/courses/<id>.json` and add its metadata entry to `public/courses/index.json` matching the `CoursePack` TypeScript interface in `src/types/harness.ts`.
