import type { CoursePack, CourseUnit, PropositionNode } from '../types/harness';

export interface DistilledConceptInput {
  id?: string;
  unitId?: string;
  title: string;
  statement: string;
  isUnconditionalTruth?: boolean;
  examWeight?: number;
  motivatedHook?: string;
  keyFormulaOrRule?: string;
  commonMisconceptions?: string[];
  confusableWith?: string;
}

export interface DistilledUnitInput {
  id?: string;
  number?: number;
  title: string;
  subtitle?: string;
  primingSummary?: string;
  unconditionalTruthSummary?: string;
  examSharePercent?: number;
}

export interface DistilledCourseInput {
  id?: string;
  code?: string;
  title?: string;
  examTitle?: string;
  institutionTag?: string;
  description?: string;
  units?: DistilledUnitInput[];
  nodes?: DistilledConceptInput[];
}

const STOP_WORDS = new Set([
  'which', 'where', 'their', 'there', 'about', 'would', 'could', 'should',
  'because', 'through', 'between', 'while', 'under', 'after', 'before',
  'these', 'those', 'being', 'having', 'other', 'another', 'first', 'second',
  'third', 'always', 'never', 'often', 'every', 'since', 'until', 'using',
  'state', 'means', 'based', 'gives', 'shows', 'holds', 'system',
]);

/**
 * Extracts salient keywords (>3 chars, non-stop words) from text.
 */
function extractKeywords(text: string, title: string): string[] {
  const words = `${title} ${text}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

  const unique = Array.from(new Set(words));
  if (unique.length > 0) return unique.slice(0, 6);
  return [title.toLowerCase().split(/\s+/)[0] || 'mechanism'];
}

/**
 * Hydrates a distilled or partial CoursePack into a complete, rich CoursePack
 * with all 4 Quizlet Learn stages, diagnostic MCQ distractors, near-twin discrimination,
 * active recall with 6-rung hint ladders (R0-R5), and Feynman application rubrics.
 */
export function hydrateCoursePack(input: DistilledCourseInput): CoursePack {
  const courseCode = (input.code || 'COURSE 101').trim();
  const courseTitle = (input.title || courseCode || 'Study Set').trim();
  const examTitle = (input.examTitle || `${courseTitle} — Final Exam`).trim();
  const courseId =
    input.id ||
    courseTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    `course-${Date.now()}`;

  // 1. Normalize Units
  const rawUnits = Array.isArray(input.units) && input.units.length > 0 ? input.units : [];
  const units: CourseUnit[] = [];

  if (rawUnits.length === 0) {
    units.push(
      {
        id: 'u1',
        number: 1,
        title: 'Unit 1: Bedrock Foundations & Core Invariants',
        subtitle: 'Unconditional truths and governing constraints',
        examSharePercent: 50,
        primingSummary: 'Master the bedrock definitions and governing invariants from which all exam problems derive.',
        unconditionalTruthSummary: 'Lock in the core definitions first before tackling multi-step causal chains.',
      },
      {
        id: 'u2',
        number: 2,
        title: 'Unit 2: Mechanisms & Causal Principles',
        subtitle: 'Dynamic behaviors and system transformations',
        examSharePercent: 50,
        primingSummary: 'Trace how perturbations propagate through the system mechanism to produce observable outputs.',
        unconditionalTruthSummary: 'Identify the governing conservation laws and boundary conditions.',
      }
    );
  } else {
    rawUnits.forEach((u, idx) => {
      const uNum = u.number || idx + 1;
      const cleanTitle = (u.title || `Unit ${uNum}`).replace(/^#+\s*/, '').trim();
      units.push({
        id: u.id || `u${uNum}`,
        number: uNum,
        title: cleanTitle,
        subtitle: u.subtitle || 'High-yield conceptual mastery',
        examSharePercent: u.examSharePercent || 0,
        primingSummary: u.primingSummary || `Focus on how ${cleanTitle} generates downstream exam applications.`,
        unconditionalTruthSummary:
          u.unconditionalTruthSummary || 'Lock in foundational invariants before tackling multi-step applications.',
      });
    });
  }

  // Normalize unit share percentages
  const sharePerUnit = Math.floor(100 / units.length);
  units.forEach((u, idx) => {
    u.examSharePercent = idx === units.length - 1 ? 100 - sharePerUnit * (units.length - 1) : sharePerUnit;
  });

  // 2. Normalize Nodes
  const rawNodes = Array.isArray(input.nodes) && input.nodes.length > 0 ? input.nodes : [];
  const validNodesInput: DistilledConceptInput[] = [];

  for (const n of rawNodes) {
    const rawTitle = (n.title || '').trim().replace(/^[*_#`\s]+|[*_#`:\s]+$/g, '');
    const rawStatement = (n.statement || '').trim().replace(/^[*_`\s]+|[*_`:\s]+$/g, '');

    // Skip blank or invalid metadata lines
    if (!rawTitle || rawTitle.length < 2) continue;
    if (/^(id|code|title|institutionTag|lastUpdated|units|nodes)$/i.test(rawTitle)) continue;

    // Target unit
    let targetUnitId = n.unitId || '';
    if (!units.some((u) => u.id === targetUnitId)) {
      targetUnitId = units[0].id;
    }

    validNodesInput.push({
      ...n,
      unitId: targetUnitId,
      title: rawTitle,
      statement: rawStatement || `${rawTitle} establishes the governing invariant for this topic.`,
    });
  }

  // Fallback if no nodes provided
  if (validNodesInput.length === 0) {
    validNodesInput.push(
      {
        unitId: units[0].id,
        title: `${courseTitle} — Core Invariant Principle`,
        statement: `The fundamental mechanism of ${courseTitle} establishes invariant constraints from which all exam scenarios derive.`,
        isUnconditionalTruth: true,
        examWeight: 5,
        motivatedHook: `What breaks if we attempt to analyze ${courseTitle} without locking in this invariant?`,
      },
      {
        unitId: units[0].id,
        title: `${courseTitle} — Dynamic Equilibrium & Perturbation`,
        statement: `When perturbed from steady state, the system responds proportionally to driving gradient divided by system resistance.`,
        isUnconditionalTruth: false,
        examWeight: 4,
        motivatedHook: `How do we predict state transitions under external stress?`,
      }
    );
  }

  // 3. Build PropositionNodes with rich 4 Quizlet stages
  const nodes: PropositionNode[] = validNodesInput.map((item, idx) => {
    const nodeId =
      item.id ||
      `node-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${idx + 1}`;

    // Link prerequisites: first node in unit is bedrock (no prereqs); later nodes depend on prior node
    const prevInUnit = validNodesInput
      .slice(0, idx)
      .filter((n) => n.unitId === item.unitId);

    const isBedrock = item.isUnconditionalTruth ?? (prevInUnit.length === 0);
    const prerequisites: string[] =
      isBedrock || prevInUnit.length === 0
        ? []
        : [prevInUnit[prevInUnit.length - 1].id || `node-${idx}`];

    const keywords = extractKeywords(item.statement, item.title);
    const misconceptions = item.commonMisconceptions && item.commonMisconceptions.length > 0
      ? item.commonMisconceptions
      : [
          `Inverting the causal arrow: assuming the outcome drives the mechanism instead of vice-versa.`,
          `Treating ${item.title} as a superficial naming convention rather than a strict constraint.`,
        ];

    const confusable = item.confusableWith || `An adjacent concept in ${courseTitle}`;

    // Plausible distractors for Stage 1 Recognition MCQ
    const distractor1 = misconceptions[0] || `The system state remains invariant regardless of ${keywords[0] || 'inputs'}.`;
    const distractor2 = misconceptions[1] || `${item.title} applies only under frictionless or zero-perturbation limits.`;
    const distractor3 = `Confusing ${item.title} with ${confusable}.`;

    return {
      id: nodeId,
      unitId: item.unitId || units[0].id,
      title: item.title,
      statement: item.statement,
      isUnconditionalTruth: isBedrock,
      prerequisites,
      examWeight: (isBedrock ? 5 : ((item.examWeight && item.examWeight >= 1 && item.examWeight <= 5) ? Math.round(item.examWeight) : 4)) as 1 | 2 | 3 | 4 | 5,
      motivatedHook:
        item.motivatedHook ||
        `Why do we need "${item.title}"? What breaks in our mental model if we ignore this mechanism?`,
      predictionPrompt: {
        question: `Before locking in "${item.title}", which core proposition must hold true under exam conditions?`,
        options: [item.statement, distractor1, distractor2, distractor3],
        correctIndex: 0,
        resolution: `Confirmed! ${item.statement}`,
      },
      teachingStep: {
        coreExplanation: `${item.statement} Because this links directly to ${
          prerequisites.length > 0 ? 'its foundational prerequisite' : 'the unit’s bedrock truth'
        }, you can derive its behavior on any exam question by tracing cause -> mechanism -> outcome.`,
        visualMentalModel: `[Foundation: ${item.title}] ──(Mechanism)──> ${item.statement.slice(0, 90)}${
          item.statement.length > 90 ? '...' : ''
        }`,
        keyFormulaOrRule: item.keyFormulaOrRule || `${item.title}: ${item.statement}`,
        checkQuestion: {
          question: `Which statement accurately captures the governing mechanism of ${item.title}?`,
          options: [
            {
              text: item.statement,
              diagnosticFeedback: 'Exact match! You have locked in the core proposition.',
            },
            {
              text: distractor1,
              misconceptionTag: 'causal-inversion',
              diagnosticFeedback: 'Careful: that inverts the causal relationship.',
            },
            {
              text: distractor2,
              misconceptionTag: 'boundary-error',
              diagnosticFeedback: 'Incorrect boundary condition: review the operating domain.',
            },
          ],
          correctIndex: 0,
        },
      },
      quizletStages: {
        recognition: {
          question: `What is the defining proposition and mechanism of "${item.title}"?`,
          options: [
            {
              text: item.statement,
              misconception: 'None',
              explanation: `Directly verified from core principles of ${item.title}.`,
            },
            {
              text: distractor1,
              misconception: 'Causal inversion or misattributed mechanism.',
              explanation: 'This inverts or misattributes the governing cause.',
            },
            {
              text: distractor2,
              misconception: 'Extreme boundary assumption.',
              explanation: 'Check whether this applies across normal operating conditions.',
            },
            {
              text: distractor3,
              misconception: 'Cross-concept category error.',
              explanation: `${item.title} plays a specific, non-interchangeable role.`,
            },
          ],
          correctIndex: 0,
        },
        discrimination: {
          scenario: `On a tricky exam problem testing "${item.title}", an unprepared student confuses it with "${confusable}".`,
          confusableWith: confusable,
          question: `How do you decisively discriminate the true behavior of "${item.title}" from "${confusable}"?`,
          options: [
            {
              text: item.statement,
              whyRightOrWrong: `Correct! This precisely isolates the separating invariant of "${item.title}".`,
            },
            {
              text: distractor1,
              whyRightOrWrong: `Incorrect: this statement describes "${confusable}" or an invalid shortcut.`,
            },
            {
              text: distractor2,
              whyRightOrWrong: `Incorrect: this confuses the boundary conditions.`,
            },
          ],
          correctIndex: 0,
        },
        cuedRecall: {
          prompt: `Without looking at options, state the core proposition and mechanism of "${item.title}".`,
          acceptedKeywords: keywords,
          canonicalAnswer: item.statement,
          hints: [
            `R0: Focus on the core role of "${item.title}" in this unit.`,
            `R1: Notice how "${item.title}" governs ${keywords[0] || 'the primary variable'}.`,
            `R2: Key terms to include: ${keywords.slice(0, 3).join(', ')}.`,
            `R3: Proposition anchor: ${item.statement.slice(0, Math.min(50, item.statement.length))}...`,
            `R4: Outline: State how ${item.title} connects ${keywords.slice(0, 2).join(' and ')} to the outcome.`,
            `R5: Complete answer: ${item.statement}`,
          ],
        },
        application: {
          examProblem: `Apply "${item.title}" to explain what occurs when its primary condition is perturbed, and justify why a common naive shortcut fails.`,
          feynmanPrompt: `Explain "${item.title}" in plain, crystal-clear language as if teaching a classmate 10 minutes before the exam.`,
          requiredMoves: [
            {
              id: 'm1',
              label: `State the governing mechanism of ${item.title} (${keywords.slice(0, 2).join(', ')})`,
              keywords: keywords.slice(0, 2),
            },
            {
              id: 'm2',
              label: `Connect to the resulting invariant outcome (${keywords.slice(2, 5).join(', ') || keywords[0]})`,
              keywords: keywords.slice(2, 5).length > 0 ? keywords.slice(2, 5) : keywords,
            },
          ],
          modelSolution: `${item.title}: ${item.statement}`,
          commonTraps: [
            `Confusing ${item.title} with ${confusable}.`,
            misconceptions[0] || 'Failing to verify the prerequisite invariant before calculating.',
          ],
          hints: [
            `R0: Identify the input condition and the output governed by ${item.title}.`,
            `R1: Include the key concepts: ${keywords.slice(0, 2).join(', ')}.`,
            `R2: Connect those to: ${keywords.slice(2, 4).join(', ') || item.title}.`,
            `R3: Core proposition: ${item.statement}`,
            `R4: Combine the mechanism and consequence in one complete sentence.`,
            `R5: Model solution: ${item.statement}`,
          ],
        },
      },
    };
  });

  return {
    id: courseId,
    code: courseCode,
    title: courseTitle,
    institutionTag: input.institutionTag || 'Custom Study Set',
    examTitle,
    description:
      input.description ||
      `Compiled study pack with ${units.length} units and ${nodes.length} interconnected propositions for 0-token Quizlet Learn + Socratic Mastery.`,
    lastUpdated: new Date().toISOString().slice(0, 10),
    units,
    nodes,
  };
}

/**
 * Deterministic 0-Token Course Compiler that turns raw lecture notes, markdown outlines,
 * or concept definitions into a complete, playable CoursePack.
 *
 * Rules:
 * - Detects embedded JSON automatically and parses it.
 * - Strips JSON keys, quotes, code fences, and metadata boilerplate.
 * - Caps units to 3–5 cohesive themes (never 18!).
 * - Caps propositions per unit to 3–6 high-yield nodes (never 156 fragmented lines!).
 * - Adheres strictly to the 80/20 Pareto generator rule and Unconditional Truths First.
 */
export function compileNotesToCoursePackLocally(params: {
  title: string;
  code: string;
  examTitle?: string;
  rawText: string;
}): CoursePack {
  const trimmed = params.rawText.trim();

  // 1. Check if raw text is already JSON or contains embedded JSON
  const jsonMatch =
    trimmed.startsWith('{')
      ? trimmed
      : trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)?.[1] ||
        trimmed.match(/(\{[\s\S]*"nodes"[\s\S]*\})/)?.[1] ||
        null;

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch) as DistilledCourseInput;
      if (parsed && ((Array.isArray(parsed.nodes) && parsed.nodes.length > 0) || (Array.isArray(parsed.units) && parsed.units.length > 0))) {
        return hydrateCoursePack({
          ...parsed,
          code: parsed.code || params.code,
          title: parsed.title || params.title,
          examTitle: parsed.examTitle || params.examTitle,
        });
      }
    } catch {
      // Not valid JSON, continue with intelligent text extraction
    }
  }

  // 2. Intelligent Line-by-Line Outline Parsing
  const rawLines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Filter out JSON syntax, code blocks, and metadata boilerplate lines
  const cleanLines: string[] = [];
  let detectedCode = params.code;
  let detectedTitle = params.title;
  let detectedInstitution = 'Compiled Study Set';

  for (const line of rawLines) {
    // Check if line is a metadata declaration like code: "AI 501" or title: "..."
    const metaMatch = line.match(/^["']?(code|title|examTitle|institutionTag)["']?\s*[:=]\s*["']?([^"',}{]+)["']?/i);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      if (key === 'code' && val) detectedCode = val;
      if (key === 'title' && val) detectedTitle = val;
      if (key === 'institutiontag' && val) detectedInstitution = val;
      continue;
    }

    // Skip JSON syntax lines: braces, brackets, commas, quotes
    if (/^[{}[\],;'"\s]+$/.test(line)) continue;
    if (/^["']?(id|lastUpdated|units|nodes|quizletStages|predictionPrompt|teachingStep|examTitle|description)["']?\s*:/i.test(line)) continue;

    // Skip standalone key names or schema labels
    if (/^["']?(code|title|institutionTag|examTitle|lastUpdated|description|units|nodes|prerequisites|examWeight)["']?$/i.test(line)) continue;
    if (/^(course identity|course metadata|meta|metadata|identity|curriculum structure)[:.]?$/i.test(line)) continue;

    // Skip autobiographical / first-person chat lines from previous AI tutoring sessions
    if (/^[-*•\s]*(i('m| am| want| do not| do NOT| have| will| would| work| run| plan| need| build| feel| hope| wish)|my (background|goal|goals|project|focus|approach|work|career))\b/i.test(line)) continue;

    // Skip conversational preamble & syllabus disclaimers
    if (/^(this is not a traditional|create a comprehensive|in this session|welcome to|course overview|disclaimer|prerequisites:)/i.test(line)) continue;

    // Skip markdown horizontal rules
    if (/^[-*_]{3,}$/.test(line)) continue;

    // Skip course logistics / syllabus noise
    if (/^(grading scale|attendance policy|office hours|zoom link|contact email|prerequisites: none|textbook required)/i.test(line)) continue;

    cleanLines.push(line);
  }

  // 3. Extract Headings and Proposition Candidates
  interface TempUnit {
    title: string;
    items: Array<{ title: string; statement: string; isUnconditional: boolean }>;
  }

  const collectedUnits: TempUnit[] = [];
  let activeUnit: TempUnit = {
    title: 'Unit 1: Foundations & Core Invariants',
    items: [],
  };

  const isHeadingLine = (line: string): boolean => {
    const t = line.trim();
    return (
      /^(#{1,3}\s+|unit\s+\d+[:.-]|module\s+\d+[:.-]|part\s+\d+[:.-]|week\s+\d+[:.-])/i.test(t) ||
      /^(\*\*[^*]{3,65}\*\*[:.]?)$/.test(t)
    );
  };

  for (const line of cleanLines) {
    if (isHeadingLine(line)) {
      const headingClean = line
        .replace(/^#{1,3}\s+/, '')
        .replace(/[*_#`]/g, '')
        .replace(/^[:.\s-]+|[:.\s-]+$/g, '')
        .trim();

      // If current unit already has items, start a new one
      if (activeUnit.items.length > 0) {
        collectedUnits.push(activeUnit);
        activeUnit = {
          title: headingClean || `Unit ${collectedUnits.length + 1}`,
          items: [],
        };
      } else {
        // Just update title of empty initial unit
        activeUnit.title = headingClean;
      }
      continue;
    }

    // Extract concept proposition candidates
    // Pattern A: "**Concept Name**: Explanation" or "Concept Name: Explanation" or "Concept Name — Explanation"
    const cleanedLine = line.replace(/^[-*•\d.)]+\s+/, '').trim();
    const sepMatch = cleanedLine.match(/^(\*\*?[^*:]+\*\*?|[^:—–]{3,65})\s*(?::|—|–|\s-\s)\s*(.{12,})$/);

    if (sepMatch) {
      const rawTerm = sepMatch[1].replace(/[*_#`"']/g, '').trim();
      const rawStatement = sepMatch[2].replace(/[*_`]/g, '').trim();

      // Reject non-concept lines (e.g. "Note:", "Warning:", "Example:")
      if (!/^(note|warning|example|caution|hint|tip|summary|conclusion|intro)$/i.test(rawTerm)) {
        activeUnit.items.push({
          title: rawTerm,
          statement: rawStatement,
          isUnconditional:
            activeUnit.items.length === 0 ||
            /law|axiom|invariant|definition|conservation|fundamental|core/i.test(rawTerm),
        });
        continue;
      }
    }

    // Pattern B: Bullet points with bold titles: "**Concept Name** is the rule that..."
    const boldLeadMatch = cleanedLine.match(/^\*\*([^*]{3,50})\*\*\s*(.{15,})$/);
    if (boldLeadMatch) {
      const rawTerm = boldLeadMatch[1].trim();
      const rawStatement = boldLeadMatch[2].trim();
      activeUnit.items.push({
        title: rawTerm,
        statement: rawStatement.startsWith('is ') || rawStatement.startsWith('states ')
          ? `${rawTerm} ${rawStatement}`
          : rawStatement,
        isUnconditional: activeUnit.items.length === 0,
      });
      continue;
    }

    // Pattern C: Significant definition sentence (>= 35 chars, contains causal or definitional words)
    if (cleanedLine.length >= 35 && /is defined as|represents|governs|determines|causes|results in|requires that|must hold/i.test(cleanedLine)) {
      // Pick first 3-5 words as clean title
      const words = cleanedLine.replace(/[*_`]/g, '').split(/\s+/);
      const titleCandidate = words.slice(0, Math.min(4, words.length)).join(' ').replace(/[.,;:]$/, '');
      activeUnit.items.push({
        title: titleCandidate,
        statement: cleanedLine.replace(/[*_`]/g, ''),
        isUnconditional: activeUnit.items.length === 0,
      });
    }
  }

  if (activeUnit.items.length > 0) {
    collectedUnits.push(activeUnit);
  }

  // Fallback if no units parsed
  if (collectedUnits.length === 0) {
    collectedUnits.push({
      title: 'Unit 1: Bedrock Foundations',
      items: [
        {
          title: `${detectedTitle} — Core Invariant`,
          statement: `The fundamental mechanism of ${detectedTitle} establishes the governing invariant from which all exam scenarios derive.`,
          isUnconditional: true,
        },
        {
          title: `${detectedTitle} — Causal System Response`,
          statement: `Perturbing the system produces a response proportional to driving force divided by system resistance.`,
          isUnconditional: false,
        },
      ],
    });
  }

  // 4. Cluster Units into Max 3–5 Cohesive Units (Never 18!)
  const maxUnits = 4;
  const finalUnits: TempUnit[] = [];

  if (collectedUnits.length <= maxUnits) {
    finalUnits.push(...collectedUnits);
  } else {
    // Merge excess units into 4 cohesive thematic units
    const chunkSize = Math.ceil(collectedUnits.length / maxUnits);
    for (let i = 0; i < maxUnits; i++) {
      const slice = collectedUnits.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length === 0) break;
      const combinedTitle = slice[0].title;
      const combinedItems = slice.flatMap((s) => s.items);
      finalUnits.push({
        title: combinedTitle,
        items: combinedItems,
      });
    }
  }

  // 5. Cap Items per Unit to 3–6 High-Yield Pareto Concepts (Never 156!)
  const distilledUnits: DistilledUnitInput[] = [];
  const distilledNodes: DistilledConceptInput[] = [];

  finalUnits.forEach((u, uIdx) => {
    const unitId = `u${uIdx + 1}`;
    distilledUnits.push({
      id: unitId,
      number: uIdx + 1,
      title: u.title.startsWith('Unit') ? u.title : `Unit ${uIdx + 1}: ${u.title}`,
      subtitle: 'High-yield conceptual mastery',
      primingSummary: `Master the foundational mechanisms of ${u.title}.`,
      unconditionalTruthSummary: 'Lock in bedrock invariants before multi-step applications.',
    });

    // Pick top 4-6 items per unit
    const cappedItems = u.items.slice(0, 5);
    if (cappedItems.length === 0) {
      cappedItems.push({
        title: `${u.title} — Governing Principle`,
        statement: `The primary mechanism governing ${u.title} defines the causal relationship between input perturbations and system output.`,
        isUnconditional: true,
      });
    }

    cappedItems.forEach((item, nIdx) => {
      distilledNodes.push({
        id: `${unitId}-n${nIdx + 1}`,
        unitId,
        title: item.title,
        statement: item.statement,
        isUnconditionalTruth: nIdx === 0 ? true : item.isUnconditional,
        examWeight: nIdx === 0 ? 5 : 4,
      });
    });
  });

  return hydrateCoursePack({
    code: detectedCode,
    title: detectedTitle,
    examTitle: params.examTitle || `${detectedTitle} — Comprehensive Exam`,
    institutionTag: detectedInstitution,
    units: distilledUnits,
    nodes: distilledNodes,
  });
}
