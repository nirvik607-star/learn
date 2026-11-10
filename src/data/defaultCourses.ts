import type { CoursePack } from '../types/harness';

export const DEFAULT_COURSES: CoursePack[] = [
  {
    id: 'cs-transformers-harness',
    code: 'CS 224N / AI-301',
    title: 'Transformers, Attention Mechanics & Agent Harnesses',
    institutionTag: 'Computer Science · Final Exam Prep',
    examTitle: 'Midterm & Final Exam: Sequence Architectures & Agent Loops',
    description:
      'Master the mathematical derivations of Scaled Dot-Product Attention, KV Caching, Backpropagation through residuals, and Agent Harness context engineering.',
    lastUpdated: '2026-11-09',
    units: [
      {
        id: 'u1-attention',
        number: 1,
        title: 'Unit 1: Scaled Dot-Product Attention & Complexity',
        subtitle: 'From raw vector alignment to quadratic attention matrices and linear approximations',
        examSharePercent: 45,
        primingSummary:
          'Before memorizing any Transformer equation, hold the single problem it solves: how can token i selectively pull information from any earlier token j in O(1) sequential depth without recurrent bottlenecks?',
        unconditionalTruthSummary:
          'All content-based retrieval in attention reduces to measuring vector alignment (dot product Q·K^T), converting scores into a probability distribution (softmax), and taking a weighted average of values (V).',
      },
      {
        id: 'u2-training-inference',
        number: 2,
        title: 'Unit 2: Backpropagation, Residuals & KV Caching',
        subtitle: 'Gradient highways during training and memory-bandwidth bottlenecks during decoding',
        examSharePercent: 30,
        primingSummary:
          'Training is compute-bound matrix multiplication in parallel; autoregressive generation is memory-bandwidth-bound vector-matrix multiplication one token at a time.',
        unconditionalTruthSummary:
          'Addition distributes gradients equally to all branches (residual highway), while caching past Keys and Values turns O(N^2) per-step recomputation into O(N) per-step memory reads.',
      },
      {
        id: 'u3-agent-harnesses',
        number: 3,
        title: 'Unit 3: Agent Harness Engineering & Pedagogical Loops',
        subtitle: 'Why harness architecture moves agent performance more than model swaps',
        examSharePercent: 25,
        primingSummary:
          'An LLM is a stateless next-token predictor; the harness supplies durable state, bounded context, verification gates, and dependency-aware planning.',
        unconditionalTruthSummary:
          'Every effective harness separates state persistence (knowledge graph / memory) from per-turn working context so errors surface immediately at the single step where they occur.',
      },
    ],
    nodes: [
      {
        id: 'dot-product-alignment',
        unitId: 'u1-attention',
        title: 'Query-Key Dot Product as Content Addressing',
        statement:
          'The dot product q_i · k_j measures directional alignment between what token i looks for (Query) and what token j advertises (Key), acting as a differentiable dictionary lookup.',
        isUnconditionalTruth: true,
        prerequisites: [],
        examWeight: 5,
        motivatedHook:
          'In a Python dict, dict[key] requires an exact match. How could we design a lookup table where a query blends multiple entries smoothly based on how relevant each key is?',
        predictionPrompt: {
          question:
            'If we want every token to retrieve a weighted blend of values from relevant tokens without hard if/else branches, what mathematical operation naturally scores similarity between two d-dimensional vectors?',
          options: [
            'Inner (dot) product q_i · k_j, which is positive when vectors point in similar directions and zero when orthogonal',
            'Element-wise subtraction q_i - k_j summed without squaring',
            'Taking the determinant of the concatenated vectors',
            'Sorting the vectors alphabetically by magnitude',
          ],
          correctIndex: 0,
          resolution:
            'Exactly! The inner product q_i · k_j = ||q_i|| ||k_j|| cos(θ) directly measures alignment and is a single fast matrix multiply QK^T across all token pairs.',
        },
        teachingStep: {
          coreExplanation:
            'Each input embedding x_i is projected into three distinct roles using learned matrices: Query (q_i = x_i W_Q: "what I am searching for"), Key (k_j = x_j W_K: "what label I advertise"), and Value (v_j = x_j W_V: "the payload I hand over if selected"). Separating Query and Key allows asymmetric relationships—for example, a verb searching for its subject does not mean the subject searches identically for the verb.',
          visualMentalModel:
            '[Token i: x_i] ──W_Q──> q_i (Search Query)\n[Token j: x_j] ──W_K──> k_j (Index Label)  ===> Score s_ij = q_i · k_j ===> Softmax weight α_ij ===> Σ α_ij v_j',
          keyFormulaOrRule: 'Attention(Q, K, V) = softmax(Q K^T / √d_k) V',
          checkQuestion: {
            question:
              'Why does self-attention project each token into separate Query (W_Q) and Key (W_K) spaces instead of just computing x_i · x_j directly?',
            options: [
              {
                text: 'Because x_i · x_j is always symmetric (s_ij = s_ji) and forces a token to attend most strongly to itself, whereas separate W_Q and W_K allow asymmetric directed lookups.',
                diagnosticFeedback:
                  'Spot on! Relevance in language is asymmetric ("chased" looks for its subject noun differently than the noun looks for modifiers).',
              },
              {
                text: 'Because dot products cannot be computed on raw embeddings x_i without first making their dimensions prime numbers.',
                misconceptionTag: 'dimension-myth',
                diagnosticFeedback:
                  'Dot products work on any matching dimension d. The issue with x_i · x_j is symmetry and lack of role separation.',
              },
              {
                text: 'To prevent backpropagating gradients into the token embedding table.',
                misconceptionTag: 'gradient-block',
                diagnosticFeedback:
                  'Gradients flow straight through W_Q, W_K, and W_V back into the token embeddings.',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'In the Transformer attention mechanism, what distinct role do the Key vectors (K) and Value vectors (V) play?',
            options: [
              {
                text: 'Keys are matched against Queries to compute attention weights α_ij, while Values hold the actual feature content summed using those weights.',
                misconception: 'None',
                explanation:
                  'Keys determine *how much* attention is paid; Values provide *what information* is passed forward.',
              },
              {
                text: 'Keys store the output probabilities for the vocabulary, while Values store the positional encoding.',
                misconception: 'Confusing attention K/V with the final LM head and positional embeddings.',
                explanation: 'Vocabulary logits are only produced at the final linear unembedding layer.',
              },
              {
                text: 'Keys and Values are identical matrices used twice only to double the parameter count.',
                misconception: 'Assuming K and V share weights.',
                explanation: 'W_K and W_V are distinct learned projection matrices serving addressing vs. payload roles.',
              },
              {
                text: 'Keys gate gradient flow during backprop, while Values are only used during inference.',
                misconception: 'Confusing forward addressing with training/inference phases.',
                explanation: 'Both K and V participate in both training and inference.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'Suppose an engineer ties W_Q = W_K (using the exact same projection matrix for Queries and Keys) in a single-head attention layer.',
            confusableWith: 'Full asymmetric Query-Key projection (W_Q ≠ W_K)',
            question:
              'What structural capability does this layer immediately lose compared to standard attention?',
            options: [
              {
                text: 'The score matrix S = QK^T becomes symmetric (s_ij = s_ji), so token i cannot attend strongly to token j without token j paying the exact same raw score to token i.',
                whyRightOrWrong:
                  'Correct! If Q = K, then QK^T = QQ^T, which is symmetric (S = S^T) and positive semi-definite.',
              },
              {
                text: 'The softmax rows will no longer sum to 1.0.',
                whyRightOrWrong: 'Incorrect: softmax normalizes any real-valued row to sum to 1.0 regardless of symmetry.',
              },
              {
                text: 'The time complexity drops from O(N^2) to O(N).',
                whyRightOrWrong: 'Incorrect: multiplying N×d by d×N still requires O(N^2 d) operations.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'State the three projection vectors created for each token in self-attention and explain why Query and Key must be separate projections.',
            acceptedKeywords: ['query', 'key', 'value', 'asymmetric', 'symmetric', 'lookup', 'address'],
            canonicalAnswer:
              'Query (search target), Key (address label), and Value (transferred content); separate W_Q and W_K enable asymmetric directed attention (s_ij ≠ s_ji).',
            hints: [
              'R0: Think of a database search: what you type in, the index label matched, and the record returned.',
              'R1: Name the 3 vectors (Q, K, V) and consider what happens to QK^T if Q = K.',
              'R2: Focus on matrix symmetry: if Q = K, then s_ij = q_i · q_j = s_ji.',
              'R3: Proposition: Separate W_Q and W_K projections break symmetry so token i can attend to j without j attending equally to i.',
              'R4: Write: (1) Query, Key, Value; (2) Q·K^T computes alignment scores; (3) W_Q ≠ W_K permits asymmetric relationships.',
              'R5: Complete answer: Tokens project to Query, Key, and Value. Separate W_Q and W_K allow asymmetric attention scores (s_ij ≠ s_ji) rather than forcing symmetric self-similarity.',
            ],
          },
          application: {
            examProblem:
              'In the sentence "The trophy did not fit in the brown suitcase because it was too big", explain step-by-step how a single self-attention head resolves the pronoun "it" to "trophy" using Q, K, and V.',
            feynmanPrompt:
              'Explain to a smart sophomore why a Transformer needs THREE matrices (Q, K, V) instead of just one, using a real-world analogy and no hand-waving.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Project "it" into a Query vector encoding "looking for a large object that failed to fit"',
                keywords: ['query', 'it', 'project', 'search', 'looking'],
              },
              {
                id: 'm2',
                label: 'Compute dot products against Keys of candidate nouns ("trophy" vs "suitcase") yielding a higher alignment score for "trophy"',
                keywords: ['key', 'dot product', 'trophy', 'score', 'alignment', 'similarity'],
              },
              {
                id: 'm3',
                label: 'Apply softmax and compute the weighted sum of Value vectors so "it" absorbs the semantic features of "trophy"',
                keywords: ['softmax', 'value', 'weighted', 'sum', 'features'],
              },
            ],
            modelSolution:
              '1) The token "it" (contextualized by "too big") projects via W_Q into a Query vector searching for an oversized object. 2) Candidate nouns "trophy" and "suitcase" project via W_K into Keys; q_it · k_trophy produces a much larger dot product than q_it · k_suitcase. 3) Softmax concentrates weight α near 1.0 on "trophy", and multiplying by V routes the Value vector v_trophy into the updated representation of "it".',
            commonTraps: [
              'Saying the Query multiplies directly with the Value vector (Queries only dot with Keys!)',
              'Forgetting that softmax normalizes across all Keys j for a fixed Query i',
            ],
            hints: [
              'R0: Trace the exact path of the token "it" through W_Q, W_K, softmax, and W_V.',
              'R1: Which vector belongs to "it", and which vectors belong to "trophy" and "suitcase"?',
              'R2: Separate the scoring phase (Q with K) from the feature-routing phase (weights with V).',
              'R3: Remember: α_it,trophy = softmax(q_it · k_trophy / √d_k), which then weights v_trophy.',
              'R4: State all 3 steps: (1) q_it from W_Q, (2) high dot product with k_trophy, (3) weighted sum of v_trophy via softmax.',
              'R5: Full worked chain: "it" emits Query q_it; dot product q_it · k_trophy beats k_suitcase; softmax assigns high weight α to trophy; output pulls v_trophy.',
            ],
          },
        },
      },
      {
        id: 'scaled-variance-softmax',
        unitId: 'u1-attention',
        title: 'Variance Scaling (1/√d_k) & Softmax Gradient Saturation',
        statement:
          'If q and k have independent zero-mean, unit-variance components, their dot product has variance d_k; dividing by √d_k restores unit variance so softmax does not saturate into near-zero gradients.',
        isUnconditionalTruth: false,
        prerequisites: ['dot-product-alignment'],
        examWeight: 5,
        motivatedHook:
          'When head dimension d_k grows from 64 to 512, training suddenly stalls right at initialization. What happens to the sum of d_k random products, and what does that do to exp(z) inside softmax?',
        predictionPrompt: {
          question:
            'If each component q_m and k_m has mean 0 and variance 1, what is the variance of their d_k-dimensional dot product Σ_{m=1}^{d_k} q_m k_m?',
          options: [
            'Variance equals d_k (standard deviation √d_k), because the variances of d_k independent terms add linearly',
            'Variance stays 1.0 regardless of d_k because positive and negative terms cancel out completely',
            'Variance equals d_k^2',
            'Variance equals 1 / d_k',
          ],
          correctIndex: 0,
          resolution:
            'Yes! While the mean stays 0, Var(Σ q_m k_m) = Σ Var(q_m k_m) = d_k. So typical dot products have magnitude ~√d_k, pushing softmax into flat tails unless we divide by √d_k!',
        },
        teachingStep: {
          coreExplanation:
            'For independent random variables with mean 0 and variance 1, each product q_m k_m has mean 0 and variance 1. Summing d_k independent terms yields Var(q · k) = d_k, meaning standard deviation is √d_k. If d_k = 256, raw logits swing by ±16! Passing ±16 into softmax(z)_i = e^{z_i} / Σ e^{z_j} makes the largest logit take ~0.999999 of the probability mass. Because the Jacobian of softmax contains α_i(1 - α_i), when α_i ≈ 1 or 0, gradients vanish to ~0 and Q/K projections freeze.',
          visualMentalModel:
            'Unscaled (d_k=256): q·k ~ N(0, 256) (std=16) ──> Softmax: [0.9999, 0.0001, 0.0000] ──> ∂L/∂z ∝ α(1-α) ≈ 0 (DEAD GRADIENTS)\nScaled (/√d_k):     q·k/√d_k ~ N(0, 1) (std=1) ──> Softmax: [0.52,   0.31,   0.17  ] ──> Healthy Gradients!',
          keyFormulaOrRule: 'Var(q · k) = d_k  ===>  Var((q · k) / √d_k) = d_k / (√d_k)^2 = 1',
          checkQuestion: {
            question:
              'Why do we divide the dot product by √d_k specifically rather than by d_k itself?',
            options: [
              {
                text: 'Because scaling a random variable by a constant c scales its standard deviation by c and its variance by c^2; dividing by √d_k divides the variance by (√d_k)^2 = d_k, restoring Var = 1.',
                diagnosticFeedback:
                  'Exact mathematical derivation: Var(X / c) = Var(X) / c^2 = d_k / d_k = 1.',
              },
              {
                text: 'Because dividing by d_k would make all dot products negative.',
                misconceptionTag: 'sign-confusion',
                diagnosticFeedback: 'd_k is a positive integer, so dividing by it never flips signs; it would just over-shrink variance to 1/d_k.',
              },
              {
                text: 'Because √d_k is the L2 norm of the Value vector V.',
                misconceptionTag: 'norm-confusion',
                diagnosticFeedback: '√d_k is a fixed architectural constant based on Key/Query dimension, not the runtime norm of V.',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'What is the direct consequence of omitting the 1/√d_k scaling factor in Scaled Dot-Product Attention when d_k is large?',
            options: [
              {
                text: 'Dot-product magnitudes grow as √d_k, pushing softmax into saturation (α_i → 0 or 1) where gradients α_i(1 - α_i) vanish.',
                misconception: 'None',
                explanation: 'Large logit gaps saturate softmax into a near-one-hot argmax with zero slope.',
              },
              {
                text: 'The attention matrix becomes non-invertible, causing a runtime divide-by-zero exception.',
                misconception: 'Thinking attention inverts QK^T.',
                explanation: 'Attention never inverts QK^T; it applies row-wise softmax.',
              },
              {
                text: 'The Value vectors V explode to infinity during the forward pass.',
                misconception: 'Confusing softmax saturation with unbounded output explosion.',
                explanation: 'Softmax weights still sum to 1, so the output remains a convex combination of V—the problem is vanishing gradients into Q and K!',
              },
              {
                text: 'The quadratic O(N^2) time complexity increases to O(N^3).',
                misconception: 'Confusing scalar scaling with asymptotic complexity.',
                explanation: 'Element-wise division by √d_k does not change asymptotic runtime.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'A student claims: "Without 1/√d_k, the forward-pass output of the attention layer explodes to infinity because QK^T is huge."',
            confusableWith: 'Vanishing gradients through saturated softmax vs. forward output explosion',
            question: 'Why is the student’s claim about the forward output exploding incorrect?',
            options: [
              {
                text: 'Because softmax still squashes any row of logits into probabilities in [0, 1] summing to 1, so the output Σ α_ij v_j stays bounded—what breaks is the backward gradient ∂softmax/∂z ≈ 0!',
                whyRightOrWrong:
                  'Brilliant discrimination! The convex combination of V stays bounded; the failure is softmax gradient saturation.',
              },
              {
                text: 'Because LayerNorm is applied inside the dot product before softmax.',
                whyRightOrWrong: 'Standard attention does not apply LayerNorm to the N×N logit matrix before softmax.',
              },
              {
                text: 'Because ReLU clips negative logits to zero.',
                whyRightOrWrong: 'Standard attention uses softmax, not ReLU.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'Derive the variance of q · k when q_m, k_m ~ (mean 0, var 1), state why we divide by √d_k, and name the failure mode in softmax if we do not.',
            acceptedKeywords: ['variance', 'd_k', 'saturation', 'vanish', 'gradient', 'softmax', 'one-hot'],
            canonicalAnswer:
              'Var(q·k) = d_k (std = √d_k); dividing by √d_k restores unit variance (Var = 1), preventing softmax saturation and vanishing gradients.',
            hints: [
              'R0: Recall how variances add for d_k independent product terms.',
              'R1: If each term q_m k_m has variance 1, what is the variance of the sum of d_k terms?',
              'R2: Remember Var(X / c) = Var(X) / c^2. Set d_k / c^2 = 1.',
              'R3: Proposition: Dividing by √d_k keeps logit variance at 1 so softmax does not saturate into flat tails.',
              'R4: Connect the 3 steps: Var(q·k) = d_k -> divide by √d_k so Var = 1 -> avoids softmax saturation / vanishing gradients.',
              'R5: Complete answer: Each q_m k_m has variance 1, so Var(q·k) = d_k. Dividing by √d_k divides variance by d_k (back to 1), preventing extreme logits from saturating softmax and killing gradients.',
            ],
          },
          application: {
            examProblem:
              'Prove that if q, k ∈ R^{d_k} have independent components with E[q_i]=E[k_i]=0 and Var(q_i)=Var(k_i)=1, then Var(q·k / √d_k) = 1. Then explain why softmax saturation stops W_Q and W_K from learning while W_V can still receive gradients.',
            feynmanPrompt:
              'Explain why dividing by √d_k is the thermostat of Transformer attention, and why W_V still gets gradients when W_Q and W_K freeze.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Show E[q_i k_i] = 0 and Var(q_i k_i) = E[q_i^2]E[k_i^2] = 1, so summing d_k independent terms gives Var(q·k) = d_k',
                keywords: ['independent', 'sum', 'var', 'd_k', 'unit'],
              },
              {
                id: 'm2',
                label: 'Apply Var(aX) = a^2 Var(X) with a = 1/√d_k to get (1/d_k)·d_k = 1',
                keywords: ['1/d_k', 'square', 'sqrt', 'restore', 'constant'],
              },
              {
                id: 'm3',
                label: 'Explain that saturated softmax (α ≈ 1 or 0) has Jacobian α(1-α) ≈ 0 blocking gradients to Q and K, whereas ∂(αV)/∂V = α still passes gradient to the winning Value v_j',
                keywords: ['jacobian', 'alpha', 'vanish', 'w_v', 'value', 'saturat'],
              },
            ],
            modelSolution:
              '1) Since q_i, k_i are independent with mean 0 and variance 1, E[q_i k_i] = E[q_i]E[k_i] = 0 and Var(q_i k_i) = E[q_i^2]E[k_i^2] = 1·1 = 1. By independence across i=1..d_k, Var(Σ q_i k_i) = d_k. 2) Scaling by 1/√d_k multiplies variance by (1/√d_k)^2 = 1/d_k, yielding Var = 1. 3) Without scaling, one α_ij ≈ 1 and others ≈ 0. Since Output = Σ α_ij v_j, ∂Out/∂v_j = α_ij ≈ 1 for the winning token (so W_V still receives gradient!), but ∂α/∂logits ∝ α(1-α) ≈ 0, completely starving W_Q and W_K of gradients.',
            commonTraps: [
              'Claiming W_V also gets zero gradient when softmax saturates to a one-hot vector',
              'Forgetting that Var(cX) = c^2 Var(X)',
            ],
            hints: [
              'R0: Look closely at Output = Σ α_j v_j. Differentiate with respect to v_j vs. with respect to logit z_j.',
              'R1: What is the derivative of Σ α_j v_j with respect to v_j when α_1 = 1?',
              'R2: Notice ∂Out/∂v_1 = α_1 = 1, while ∂α_1/∂z_1 = α_1(1 - α_1) = 0!',
              'R3: Combine the variance proof Var(q·k / √d_k) = (1/d_k) d_k = 1 with the Jacobian split between V and Q/K.',
              'R4: Write: (1) Var(q_i k_i)=1 => Var(q·k)=d_k; (2) Var(/√d_k)=1; (3) α(1-α)→0 kills Q/K gradients, while α_winner≈1 still passes gradient to W_V.',
              'R5: Complete derivation: Independent unit-variance terms sum to variance d_k; dividing by √d_k scales variance by 1/d_k back to 1. Saturated softmax has zero derivative α(1-α)=0 for Q/K, but passes weight α=1 directly to the winning V.',
            ],
          },
        },
      },
      {
        id: 'quadratic-vs-linear-attention',
        unitId: 'u1-attention',
        title: 'Quadratic O(N²d) Bottleneck vs. Linear Attention Associativity',
        statement:
          'Standard attention computes softmax(QK^T)V in O(N²d) because softmax couples all N×N token pairs before multiplying V; linear attention drops softmax to associate Q(K^T V) in O(N d²), trading sharp token-specific lookup for fixed-size summary compression.',
        isUnconditionalTruth: false,
        prerequisites: ['dot-product-alignment', 'scaled-variance-softmax'],
        examWeight: 4,
        motivatedHook:
          'Why does doubling context length N quadruple attention compute, and what single mathematical barrier stops us from just multiplying K^T V first?',
        predictionPrompt: {
          question:
            'In the product (Q K^T) V where Q, K, V ∈ R^{N × d}, why can’t standard Transformer attention simply use matrix associativity Q (K^T V) to reduce complexity from O(N²d) to O(Nd²)?',
          options: [
            'Because the non-linear element-wise softmax(.) sits around softmax(Q K^T), preventing us from factoring K^T V first',
            'Because matrix multiplication is never associative when N > d',
            'Because V has a different sequence length N than K',
            'Because GPUs cannot multiply d × N by N × d matrices',
          ],
          correctIndex: 0,
          resolution:
            'Spot on! Without softmax, (QK^T)V = Q(K^T V). The non-linear softmax(QK^T) forces materializing the N×N score matrix first unless we replace exp(q·k) with a separable kernel φ(q)φ(k)^T!',
        },
        teachingStep: {
          coreExplanation:
            'In standard attention, Q, K, V have shape (N × d). Forming S = QK^T produces an (N × N) matrix in O(N²d) time and O(N²) memory. If we replace softmax(q_i · k_j) with a decomposable feature map φ(q_i) · φ(k_j)^T, then by matrix associativity: (φ(Q) φ(K)^T) V = φ(Q) (φ(K)^T V). Here M = φ(K)^T V is a fixed (d × d) state matrix computed in O(N d²)! However, compressing N tokens into a fixed d × d matrix loses exact needle-in-a-haystack resolution when N ≫ d.',
          visualMentalModel:
            'Standard: [Q (N×d) · K^T (d×N)] ──> Softmax (N×N) · V (N×d) ===> O(N²d) time, sharp exact retrieval\nLinear:   φ(Q) (N×d) · [φ(K)^T (d×N) · V (N×d)] ──> State (d×d) ===> O(Nd²) time, lossy d×d bottleneck',
          keyFormulaOrRule: '(φ(Q) φ(K)^T) V = φ(Q) (φ(K)^T V)  [O(N²d) ──> O(Nd²)]',
          checkQuestion: {
            question:
              'What does Linear Attention sacrifice in exchange for reducing time complexity from O(N²d) to O(Nd²)?',
            options: [
              {
                text: 'All N historical key-value pairs are superposed into a fixed d×d matrix (φ(K)^T V), causing retrieval interference ("blurriness") when N exceeds capacity d.',
                diagnosticFeedback:
                  'Exactly—just like an RNN state of fixed size d×d, it cannot store arbitrarily many sharp, independent key-value associations without crosstalk.',
              },
              {
                text: 'It can no longer run on parallel GPUs during training.',
                misconceptionTag: 'parallelism-myth',
                diagnosticFeedback: 'Linear attention is even faster to parallelize across chunks during training!',
              },
              {
                text: 'It requires O(N^3) memory during inference.',
                misconceptionTag: 'memory-myth',
                diagnosticFeedback: 'Linear attention uses O(d^2) constant recurrent memory during inference!',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'Why does Linear Attention achieve O(N d²) complexity instead of O(N² d)?',
            options: [
              {
                text: 'It replaces non-linear softmax with a separable kernel φ(Q)φ(K)^T, allowing associative reordering φ(Q)(φ(K)^T V) where φ(K)^T V is a d×d matrix.',
                misconception: 'None',
                explanation: 'Associativity avoids ever constructing the N×N attention matrix.',
              },
              {
                text: 'It randomly drops 90% of the tokens in the sequence before computing QK^T.',
                misconception: 'Confusing linear attention with token pruning.',
                explanation: 'Linear attention processes all N tokens via the associative product.',
              },
              {
                text: 'It sets d = 1 for all heads.',
                misconception: 'Dimension collapse myth.',
                explanation: 'Head dimension d remains standard (e.g., 64 or 128).',
              },
              {
                text: 'It computes QK^T in int4 precision while keeping O(N²) operations.',
                misconception: 'Confusing quantization with algorithmic complexity.',
                explanation: 'Quantization reduces constant factors, not asymptotic O(N²) scaling.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'You are designing an model that must copy an exact 16-digit UUID mentioned 50,000 tokens earlier ("needle in a haystack").',
            confusableWith: 'Full Softmax Attention vs. Pure Linear Attention (fixed d×d state)',
            question:
              'Which architecture struggles on exact long-range copying and why?',
            options: [
              {
                text: 'Pure Linear Attention struggles because its fixed d×d state (φ(K)^T V) has finite rank ≤ d and lacks the exponential sharpness of softmax to isolate one exact past token out of 50,000.',
                whyRightOrWrong:
                  'Correct! Softmax can concentrate ~100% weight on a single token across N=50,000 because it keeps all N keys distinct; linear attention superposes them into d×d.',
              },
              {
                text: 'Full Softmax Attention struggles because O(N²) matrices cannot represent identity mappings.',
                whyRightOrWrong: 'Full softmax attention excels at exact induction-head copying.',
              },
              {
                text: 'Both fail equally because dot products cannot compare token embeddings.',
                whyRightOrWrong: 'Full attention solves needle-in-a-haystack reliably.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'Write the matrix parenthesization trick used by Linear Attention, its asymptotic complexity, and the fundamental representation tradeoff it makes.',
            acceptedKeywords: ['associativ', 'd^2', 'nd^2', 'softmax', 'bottleneck', 'fixed', 'sharp'],
            canonicalAnswer:
              'Reorders (φ(Q)φ(K)^T)V to φ(Q)(φ(K)^T V) reducing O(N²d) to O(Nd²), trading sharp unbounded N×N lookup for a lossy fixed-size d×d state.',
            hints: [
              'R0: Compare the matrix shapes of (QK^T)V vs. Q(K^T V).',
              'R1: What is the shape of K^T V when K and V are both N × d?',
              'R2: K^T V has shape d × d! What stops us from doing that in standard attention?',
              'R3: Proposition: Replacing softmax with φ(Q)φ(K)^T unlocks associativity φ(Q)(φ(K)^T V) in O(Nd²), compressing history into a d×d state.',
              'R4: State: (1) Associative product φ(Q)(φ(K)^T V), (2) O(Nd²) runtime, (3) lossy d×d superposition vs sharp softmax.',
              'R5: Complete answer: Linear attention drops non-linear softmax for φ(Q)(φ(K)^T V), cutting complexity from O(N²d) to O(Nd²) at the cost of compressing all N tokens into a fixed d×d matrix.',
            ],
          },
          application: {
            examProblem:
              'Derive the exact FLOP scaling of (QK^T)V versus Q(K^T V) for Q, K, V ∈ R^{N×d} when N = 32,768 and d = 64. Explain why standard attention cannot use the second order directly and how Linear Attention’s d×d state behaves like an RNN during inference.',
            feynmanPrompt:
              'Explain why parentheses placement in matrix multiplication is the difference between a 10-second response and running out of GPU memory.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Calculate shapes & FLOPs: (QK^T)V forms an N×N intermediate taking ~2N²d ops, whereas Q(K^T V) forms a d×d intermediate taking ~2Nd² ops (512× fewer when N=32768, d=64)',
                keywords: ['n^2', 'nd^2', 'd×d', 'n×n', '512', 'shape', 'intermediate'],
              },
              {
                id: 'm2',
                label: 'Explain that row-wise non-linear softmax(QK^T) prevents factoring K^T V unless replaced by a kernel feature map φ(q)φ(k)^T',
                keywords: ['softmax', 'non-linear', 'kernel', 'separable', 'factor'],
              },
              {
                id: 'm3',
                label: 'Show that during autoregressive inference, S_t = S_{t-1} + φ(k_t)v_t^T updates in O(d²) constant memory like an RNN, losing exact recall when N ≫ d',
                keywords: ['recurrent', 'rnn', 's_t', 'constant memory', 'lossy', 'superpos'],
              },
            ],
            modelSolution:
              '1) For Q, K, V ∈ R^{N×d}: (QK^T) produces an N×N matrix in O(N²d) FLOPs, then multiplies V in O(N²d). By contrast, (K^T V) multiplies (d×N)(N×d) into a (d×d) matrix in O(Nd²), then Q(K^T V) takes O(Nd²). With N=32,768 and d=64, N/d = 512× faster! 2) Standard attention applies element-wise exp() and row normalization across QK^T, which does not factor across the matrix product. Linear attention substitutes φ(q_i)φ(k_j)^T. 3) At inference, the cumulative state S_t = Σ_{j≤t} φ(k_j) v_j^T ∈ R^{d×d} updates recurrently in O(d²) time and memory per token, but acts as a finite-capacity associative memory that blurs sharp lookups over long contexts.',
            commonTraps: [
              'Writing that K^T V has shape N×N instead of d×d',
              'Forgetting that recurrent inference memory in Linear Attention is O(d²), independent of N',
            ],
            hints: [
              'R0: Write down the dimensions: Q is (N×d), K^T is (d×N), V is (N×d).',
              'R1: Multiply K^T (d×N) by V (N×d) first. What is the resulting matrix shape and cost?',
              'R2: Now divide N²d by Nd² for N=32768, d=64.',
              'R3: Express the recurrent state S_t = S_{t-1} + φ(k_t)v_t^T and note its fixed d×d size.',
              'R4: Combine all 3 moves: (1) O(N²d) vs O(Nd²) with N/d=512x ratio; (2) softmax blocks associativity; (3) O(d²) RNN state update & capacity limit.',
              'R5: Full solution: (QK^T)V forms an N×N matrix in O(N²d); Q(K^T V) forms a d×d matrix in O(Nd²) (512x smaller). Softmax blocks factoring unless replaced by φ(Q)φ(K)^T, which gives an O(d²) recurrent state S_t that trades exact N-token recall for constant memory.',
            ],
          },
        },
      },
      {
        id: 'residual-gradient-highway',
        unitId: 'u2-training-inference',
        title: 'Residual Connections (x + F(x)) as Unimpeded Gradient Highways',
        statement:
          'Because the derivative of y = x + F(x) with respect to x is I + ∂F/∂x, the identity term I guarantees that upstream gradients flow directly to early layers via addition even when ∂F/∂x vanishes.',
        isUnconditionalTruth: true,
        prerequisites: [],
        examWeight: 5,
        motivatedHook:
          'In a 96-layer network without skip connections, multiplying 96 Jacobians less than 1 shrinks gradients to 0. What elementary operation has a derivative of 1.0 no matter how deep you stack it?',
        predictionPrompt: {
          question:
            'If a layer computes y = x + F(x) instead of y = F(x), what is the Jacobian ∂y/∂x during backpropagation?',
          options: [
            'I + ∂F/∂x — the identity matrix I plus the sublayer Jacobian, ensuring gradients can pass unmodified through the +1 branch',
            'x · ∂F/∂x — the product of input and gradient',
            'Only ∂F/∂x, because x is treated as a constant during backprop',
            'Zero whenever F(x) saturates',
          ],
          correctIndex: 0,
          resolution:
            'Exactly! Addition is a gradient distributor: ∂(x + F(x))/∂x = I + ∂F/∂x. Even if ∂F/∂x = 0 in some layer, the identity term I carries the upstream gradient ∂L/∂y straight back!',
        },
        teachingStep: {
          coreExplanation:
            'In plain deep networks y_L = f_L(f_{L-1}(...f_1(x))), the chain rule multiplies Jacobians: ∂y_L/∂x = Π_{l=1}^L ∂f_l/∂x_{l-1}. If each spectral norm is 0.8 across 100 layers, 0.8^{100} ≈ 2×10^{-10} (vanishing gradient). With residual blocks x_l = x_{l-1} + F_l(x_{l-1}), unrolling from layer l to L gives x_L = x_l + Σ_{m=l+1}^L F_m(x_{m-1}). Differentiating yields ∂L/∂x_l = ∂L/∂x_L · (I + ∂/∂x_l Σ F_m). The direct additive term ∂L/∂x_L reaches layer l untouched by intermediate multiplicative decay!',
          visualMentalModel:
            'Forward:  x_{l-1} ──┬───────────────(+)──> x_l = x_{l-1} + F(x_{l-1})\n                    └──> [ F(x) ] ──┘\nBackward: ∂L/∂x_{l-1} = ∂L/∂x_l · I  +  ∂L/∂x_l · (∂F/∂x_{l-1})  [Direct Superhighway!]',
          keyFormulaOrRule: '∂L / ∂x_l = ∂L / ∂x_L + (∂L / ∂x_L) · ∂/∂x_l [ Σ_{m=l+1}^L F_m(x_{m-1}) ]',
          checkQuestion: {
            question:
              'If a single attention or MLP block F_k(x) in layer k has zero weights (∂F_k/∂x = 0) at initialization, what happens to the gradient flowing from layer k+1 to layer k-1 in a Residual Transformer?',
            options: [
              {
                text: 'The gradient passes through completely intact (∂x_k / ∂x_{k-1} = I + 0 = I), whereas in a non-residual network it would be multiplied by 0 and killed.',
                diagnosticFeedback:
                  'Spot on! That is why residual networks can initialize residual projections near zero ("Zero-Init") and still train hundreds of layers.',
              },
              {
                text: 'All layers below layer k receive zero gradient and freeze.',
                misconceptionTag: 'multiplicative-chain-confusion',
                diagnosticFeedback: 'That only happens in a purely sequential y = F(x) stack without the +x skip branch!',
              },
              {
                text: 'The gradient doubles at every layer.',
                misconceptionTag: 'doubling-confusion',
                diagnosticFeedback: 'When ∂F_k/∂x = 0, the Jacobian is I + 0 = I, so the gradient is preserved, not doubled.',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'Why do residual connections x_l = x_{l-1} + F_l(x_{l-1}) prevent vanishing gradients in deep Transformers?',
            options: [
              {
                text: 'The Jacobian ∂x_l/∂x_{l-1} = I + ∂F_l/∂x_{l-1} contains an additive identity matrix I, creating a direct path for ∂L/∂x_L to reach every earlier layer.',
                misconception: 'None',
                explanation: 'Addition distributes the upstream gradient along both the skip path and the residual branch.',
              },
              {
                text: 'They clip all gradients to [-1, 1] after every matrix multiplication.',
                misconception: 'Confusing residual connections with gradient clipping.',
                explanation: 'Residuals are an architectural identity addition, not gradient clipping.',
              },
              {
                text: 'They remove the need for backpropagation by using local Hebbian updates.',
                misconception: 'Backprop elimination myth.',
                explanation: 'Transformers still use exact end-to-end backpropagation.',
              },
              {
                text: 'They replace matrix multiplications with max-pooling.',
                misconception: 'Architecture confusion.',
                explanation: 'Attention and FFN blocks still use dense linear projections.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'Compare Pre-LN Transformer blocks: x_l = x_{l-1} + F(LN(x_{l-1})) versus Post-LN blocks: x_l = LN(x_{l-1} + F(x_{l-1})).',
            confusableWith: 'Pre-LN vs. Post-LN residual stream gradient flow',
            question:
              'Why does Pre-LN train stably at 100+ layers without a long learning-rate warmup while Post-LN struggles?',
            options: [
              {
                text: 'In Pre-LN, the main residual stream x_L = x_0 + Σ F_m(LN(x_{m-1})) has a pure, unnormalized identity path all the way from x_L to x_0, whereas Post-LN wraps every step in LayerNorm’s Jacobian.',
                whyRightOrWrong:
                  'Exact distinction! Pre-LN keeps the identity highway completely clean from output to input.',
              },
              {
                text: 'Because Pre-LN uses fewer parameters in its LayerNorm layers.',
                whyRightOrWrong: 'Both use the exact same number of γ and β parameters.',
              },
              {
                text: 'Because Post-LN cannot be differentiated on GPUs.',
                whyRightOrWrong: 'Both are fully differentiable; the difference is conditioning of the gradient highway.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'Write the forward equation and backward Jacobian of a residual block, and explain why Pre-LN preserves a cleaner gradient highway than Post-LN.',
            acceptedKeywords: ['identity', 'i +', 'jacobian', 'addition', 'pre-ln', 'unimpeded', 'vanish'],
            canonicalAnswer:
              'Forward: y = x + F(x); Backward Jacobian: ∂y/∂x = I + ∂F/∂x. Pre-LN keeps LayerNorm inside F(LN(x)) so the main skip stream remains a pure identity sum from x_L to x_0.',
            hints: [
              'R0: Differentiate y = x + F(x) with respect to x.',
              'R1: What is ∂x/∂x in vector calculus?',
              'R2: It is the Identity matrix I! Now compare where LayerNorm sits in Pre-LN vs Post-LN.',
              'R3: Proposition: ∂(x + F(x))/∂x = I + ∂F/∂x; Pre-LN places LN on the branch F(LN(x)) so the skip path stays a pure identity highway.',
              'R4: Write: (1) y = x + F(x), (2) ∂y/∂x = I + ∂F/∂x, (3) Pre-LN avoids multiplying by ∂LN/∂x along the main trunk.',
              'R5: Complete answer: Residual blocks compute y = x + F(x) with Jacobian I + ∂F/∂x, transmitting upstream gradients via I even when ∂F/∂x vanishes. Pre-LN keeps LN inside the branch so the trunk is a pure identity sum.',
            ],
          },
          application: {
            examProblem:
              'Unroll the recurrence x_l = x_{l-1} + F_l(x_{l-1}) from layer l to final layer L, derive ∂L/∂x_l in terms of ∂L/∂x_L, and explain why initializing the final projection of each block F_l near zero helps deep Transformer stability.',
            feynmanPrompt:
              'Explain how a residual connection acts like an express elevator for error signals in a 100-story skyscraper.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Unroll telescoping sum: x_L = x_l + Σ_{m=l+1}^L F_m(x_{m-1})',
                keywords: ['unroll', 'sum', 'x_l', 'x_L', 'sigma'],
              },
              {
                id: 'm2',
                label: 'Differentiate via chain rule: ∂L/∂x_l = ∂L/∂x_L · (I + ∂/∂x_l Σ F_m)',
                keywords: ['chain rule', 'identity', '∂l/∂x', 'derivative', 'i +'],
              },
              {
                id: 'm3',
                label: 'Explain Zero-Init: when F_m ≈ 0 at start of training, x_L ≈ x_0 and ∂x_L/∂x_l ≈ I, so every layer receives clean, unit-scale gradients immediately',
                keywords: ['zero', 'init', 'unit', 'scale', 'clean', 'preserve'],
              },
            ],
            modelSolution:
              '1) By telescoping addition, x_L = x_l + Σ_{m=l+1}^L F_m(x_{m-1}). 2) Applying the chain rule from loss L: ∂L/∂x_l = (∂L/∂x_L)(∂x_L/∂x_l) = ∂L/∂x_L + (∂L/∂x_L) · ∂/∂x_l [Σ_{m=l+1}^L F_m(x_{m-1})]. 3) Because ∂L/∂x_L appears additively outside the residual sum, gradients cannot vanish even if the second term is small. Initializing the output projection of each F_m near zero makes ∂F_m/∂x ≈ 0 at step 0, so the entire 100-layer network initially acts like the identity map (∂x_L/∂x_l = I) and every layer receives well-conditioned gradients from the very first batch.',
            commonTraps: [
              'Writing ∂x_L/∂x_l as a product of F_m rather than I + ∂(Σ F_m)/∂x_l',
              'Confusing zero-initializing the output projection of F_l with zero-initializing all weights (which would kill symmetry breaking)',
            ],
            hints: [
              'R0: Write x_{l+1} = x_l + F_{l+1}(x_l), then substitute into x_{l+2}, up to x_L.',
              'R1: Differentiate x_L = x_l + Σ F_m with respect to x_l.',
              'R2: Notice the first term ∂x_l/∂x_l = I!',
              'R3: Now evaluate I + ∂(Σ F_m)/∂x_l when the last linear layer of each F_m is initialized to 0.',
              'R4: State all 3 parts: (1) x_L = x_l + Σ F_m; (2) ∂L/∂x_l = ∂L/∂x_L (I + ∂ΣF/∂x_l); (3) Zero-init makes Jacobian ≈ I at step 0.',
              'R5: Complete derivation: Unrolling gives x_L = x_l + Σ F_m. Differentiating gives ∂L/∂x_l = ∂L/∂x_L (I + ∂ΣF/∂x_l), preserving the direct ∂L/∂x_L term. Near-zero output init of F_m sets the Jacobian close to I so deep networks train stably from step 1.',
            ],
          },
        },
      },
      {
        id: 'kv-cache-roofline',
        unitId: 'u2-training-inference',
        title: 'KV Caching & The Memory-Bandwidth Decoding Roofline',
        statement:
          'Because causal masking prevents future tokens from altering past Keys and Values, caching K_{1..t-1} and V_{1..t-1} reduces per-token decoding compute from O(t²d) to O(td), shifting the bottleneck from GPU FLOPs to HBM memory bandwidth.',
        isUnconditionalTruth: false,
        prerequisites: ['dot-product-alignment', 'residual-gradient-highway'],
        examWeight: 4,
        motivatedHook:
          'When generating token #1000, why would we recompute the Keys and Values for tokens 1..999 if causal masking guarantees they can never see token #1000 anyway?',
        predictionPrompt: {
          question:
            'In a causal (decoder-only) Transformer, when token t arrives during generation, do the hidden representations, Keys, or Values of earlier tokens 1..t-1 change?',
          options: [
            'No — because causal masking blocks tokens 1..t-1 from attending to token t, their K and V vectors are invariant and can be cached once',
            'Yes — every earlier token must update its Key to include token t',
            'Only the Queries of tokens 1..t-1 are needed to compute token t’s output',
            'Only the final layer can be cached because earlier layers are bidirectional',
          ],
          correctIndex: 0,
          resolution:
            'Spot on! Causal masking makes tokens 1..t-1 strictly a function of prefix 1..t-1. So we only compute q_t, k_t, v_t for the new token, append (k_t, v_t) to the KV cache, and dot q_t against K_{1..t}!',
        },
        teachingStep: {
          coreExplanation:
            'To emit token t+1, we only need the final output at position t: y_t = Σ_{j=1}^t softmax(q_t · k_j / √d_k) v_j. Notice that q_1..q_{t-1} are never used again! Only k_1..k_t and v_1..v_t are needed. By storing K and V in GPU High-Bandwidth Memory (KV Cache), step t performs a vector-matrix product q_t K_{1..t}^T in O(td) FLOPs instead of recomputing the full prefix in O(t²d). However, because each weight matrix and KV cache entry is loaded from HBM just to process a single vector q_t (batch=1), arithmetic intensity (FLOPs per byte loaded) is ~1–2, making decoding strictly memory-bandwidth bound!',
          visualMentalModel:
            'Without KV Cache (Step t): Recompute Q,K,V for all t tokens ──> O(t²d) FLOPs\nWith KV Cache (Step t):    Compute ONLY q_t, k_t, v_t ──> Append [k_t, v_t] to Cache ──> q_t · K_{1..t}^T ──> O(td) FLOPs (Memory-Bandwidth Bound!)',
          keyFormulaOrRule:
            'KV Cache Bytes = 2 (K & V) × L (layers) × n_kv_heads × d_head × N (tokens) × bytes_per_param',
          checkQuestion: {
            question:
              'Why don’t we also cache the past Query vectors Q_{1..t-1} in the KV cache during autoregressive generation?',
            options: [
              {
                text: 'Because at generation step t, we only compute the output representation for position t (using q_t against K_{1..t} and V_{1..t}); past outputs y_{1..t-1} are already finalized.',
                diagnosticFeedback:
                  'Exactly! Query q_j was only needed at step j to produce token j+1.',
              },
              {
                text: 'Because Queries are 100× larger than Keys in memory.',
                misconceptionTag: 'size-confusion',
                diagnosticFeedback: 'q_j and k_j have the exact same dimension d_k.',
              },
              {
                text: 'Because Queries change retroactively when future tokens are generated.',
                misconceptionTag: 'causality-confusion',
                diagnosticFeedback: 'In a causal decoder, past Queries never change either—they are simply no longer needed!',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'What is the exact formula for KV Cache memory size (in bytes) for a single sequence of length N across L layers?',
            options: [
              {
                text: '2 × L × n_kv_heads × d_head × N × bytes_per_element (where the factor of 2 accounts for both K and V).',
                misconception: 'None',
                explanation: 'Each token stores one Key and one Value vector per KV head per layer.',
              },
              {
                text: '3 × L × N² × bytes_per_element (storing Q, K, and the N×N attention matrix).',
                misconception: 'Thinking Q and the N×N attention matrix are cached.',
                explanation: 'Neither Q nor the N×N attention weights are persisted across steps.',
              },
              {
                text: 'L × vocab_size × bytes_per_element.',
                misconception: 'Confusing KV cache with output logits.',
                explanation: 'KV cache scales with hidden dimension and sequence length N, not vocabulary size.',
              },
              {
                text: 'It is constant O(1) with respect to sequence length N.',
                misconception: 'Confusing Transformer KV cache with RNN state.',
                explanation: 'Transformer KV cache grows linearly O(N) with sequence length.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'Compare the Prefill phase (processing a 4,000-token user prompt all at once) against the Decode phase (generating 200 answer tokens one by one with a KV cache).',
            confusableWith: 'Compute-bound Prefill (Matrix-Matrix) vs. Memory-Bandwidth-bound Decode (Vector-Matrix)',
            question:
              'Why is Prefill compute-bound (FLOP-limited) while Decode is memory-bandwidth-bound on modern GPUs?',
            options: [
              {
                text: 'Prefill processes 4,000 tokens simultaneously (matrix-matrix multiply, reusing loaded weights 4,000 times), whereas Decode loads all model weights + KV cache from HBM just to multiply a single token vector (arithmetic intensity ~1 FLOP/byte).',
                whyRightOrWrong:
                  'Exact Roofline analysis! Weight reuse across N=4,000 tokens gives high arithmetic intensity; single-token decoding starves the tensor cores waiting on HBM reads.',
              },
              {
                text: 'Because Prefill runs on the CPU while Decode runs on the GPU.',
                whyRightOrWrong: 'Both Prefill and Decode run on the GPU.',
              },
              {
                text: 'Because KV caching increases the total FLOPs of the Decode phase.',
                whyRightOrWrong: 'KV caching drastically reduces FLOPs, which is precisely why FLOPs are no longer the bottleneck!',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'State why causal masking makes KV caching valid, why Queries are not cached, and why grouped-query attention (GQA) speeds up decoding.',
            acceptedKeywords: ['causal', 'query', 'bandwidth', 'memory', 'k and v', 'gqa', 'head'],
            canonicalAnswer:
              'Causal masking ensures past K/V never depend on future tokens; past Queries are unneeded since only position t is decoded; GQA shares fewer KV heads across Query heads to shrink HBM bandwidth reads.',
            hints: [
              'R0: Think about what position t needs to compute y_t, and what the GPU waits on during decoding.',
              'R1: Why don’t k_1..k_{t-1} change when token t arrives? Why don’t we need q_1..q_{t-1}?',
              'R2: Since decoding is memory-bandwidth bound, what happens if 8 Query heads share 1 Key-Value head (GQA)?',
              'R3: Proposition: Causal masking freezes past K/V; only q_t is active at step t; GQA cuts KV cache size & HBM traffic by sharing KV heads.',
              'R4: Write: (1) Causal mask => invariant past K/V; (2) Only q_t needed for step t; (3) GQA reduces n_kv_heads to relieve HBM bandwidth.',
              'R5: Complete answer: Causal masking keeps past K/V fixed; past Queries aren’t needed because only y_t is computed; GQA shares KV heads across multiple Query heads, slashing KV cache memory and HBM bandwidth.',
            ],
          },
          application: {
            examProblem:
              'Calculate the KV cache size in GB for a 32-layer model with 32 Query heads, 8 KV heads (GQA), head dimension d_head = 128, sequence length N = 16,384, and fp16 (2 bytes/element). How much memory did 8-head GQA save compared to Multi-Head Attention (32 KV heads)?',
            feynmanPrompt:
              'Walk through the exact byte math of a KV cache and explain why shrinking it makes tokens stream 4x faster on a laptop or GPU.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Apply formula: 2 × 32 layers × 8 kv_heads × 128 d_head × 16,384 tokens × 2 bytes',
                keywords: ['2 * 32', '2 × 32', '128', '16384', '16,384', 'formula'],
              },
              {
                id: 'm2',
                label: 'Compute result: 2,147,483,648 bytes = 2.0 GiB (approx 2.15 GB)',
                keywords: ['2 gb', '2.0', '2.15', '2 gib', 'billion'],
              },
              {
                id: 'm3',
                label: 'Compare to MHA (32 KV heads): MHA would take 8.0 GiB, so GQA (8 KV heads) saves 4× (6.0 GiB) and cuts HBM memory-bandwidth read time by 4×',
                keywords: ['4x', '4×', '8 gb', '8.0', '6 gb', 'bandwidth', 'mha'],
              },
            ],
            modelSolution:
              '1) Per token per layer: 2 (K and V) × 8 KV heads × 128 d_head × 2 bytes (fp16) = 4,096 bytes (4 KB). 2) Across 32 layers and N = 16,384 tokens: 4,096 × 32 × 16,384 = 2,147,483,648 bytes = 2.0 GiB (2.15 GB). 3) Standard MHA with 32 KV heads would require 4 × 2.0 GiB = 8.0 GiB. Thus 8-head GQA saves 6.0 GiB (75% reduction) and reduces KV cache HBM bandwidth reads per decoded token by 4×.',
            commonTraps: [
              'Multiplying by 32 Query heads instead of 8 KV heads',
              'Forgetting the factor of 2 for storing both Keys AND Values',
            ],
            hints: [
              'R0: Use: Bytes = 2 (K,V) × L × n_kv_heads × d_head × N × 2 bytes.',
              'R1: First compute bytes per token per layer: 2 × 8 × 128 × 2 = 4,096 bytes.',
              'R2: Multiply 4,096 bytes × 32 layers × 16,384 tokens.',
              'R3: Note 4,096 = 2^{12}, 32 = 2^5, 16,384 = 2^{14}, so total is 2^{31} bytes = 2.0 GiB! Compare 8 KV heads vs 32 KV heads.',
              'R4: Write: (1) Formula substitution, (2) 2.0 GiB total, (3) 4x reduction vs 8.0 GiB MHA.',
              'R5: Complete answer: 2 × 32 × 8 × 128 × 16,384 × 2 = 2.0 GiB (2.15 GB). Compared to 32-head MHA (8.0 GiB), GQA cuts KV cache size and HBM bandwidth by 4× (saving 6.0 GiB).',
            ],
          },
        },
      },
      {
        id: 'harness-state-separation',
        unitId: 'u3-agent-harnesses',
        title: 'Agent Harness State Separation & Single-Step Verification',
        statement:
          'A high-reliability agent harness externalizes durable state (knowledge graph, plan, rubric) outside the chat stream and verifies each atomic reasoning step before building downstream steps on top of it.',
        isUnconditionalTruth: true,
        prerequisites: [],
        examWeight: 4,
        motivatedHook:
          'Why did changing only the agent harness (with the exact same LLM weights) jump a coding/tutoring agent from 30th place to Top 5 on Terminal-Bench?',
        predictionPrompt: {
          question:
            'If an AI agent executes 10 dependent steps in one unchecked monologue and step 2 contains a subtle flaw, what happens to steps 3 through 10?',
          options: [
            'Errors compound exponentially: steps 3–10 build on the corrupted premise from step 2, wasting tokens and poisoning the context window',
            'Step 10 automatically cancels out the error in step 2',
            'The model’s temperature resets to zero after step 2',
            'Nothing changes because LLMs do not condition on their own prior output tokens',
          ],
          correctIndex: 0,
          resolution:
            'Spot on! Because autoregressive models condition on their own generated tokens, an unchecked error in step 2 corrupts every subsequent step. A harness checks each landing immediately!',
        },
        teachingStep: {
          coreExplanation:
            'In both coding harnesses (Claude Code, Codex) and learning harnesses (LearnHarness), the model is wrapped in an explicit control loop: (1) Instructions & Context (CLAUDE.md / AGENTS.md), (2) Persistent Structured Memory (e.g., a proposition-and-premise Knowledge Graph stored on disk so sessions stay short and cheap), (3) Minimal Dependency Planning (pruning already-held nodes), and (4) Single-Step Execution with Verification Gates (checking each step before advancing). Localizing errors at step k means repairing 1 node instead of regenerating an entire corrupted trajectory.',
          visualMentalModel:
            'Unchecked Monologue: Step 1 ──> Step 2 (Error!) ──> Step 3 (Corrupted) ──> Step 4 (Hallucinated) [High Token Waste]\nHarness Loop:        Probe Edge ──> Minimal Plan ──> Step k ──> Check Gate ──> (If Miss: Surgical Repair) ──> Update Graph',
          keyFormulaOrRule:
            'P(N-step trajectory succeeds unchecked) = p^N   vs.   Step-verified with repair: 1 - (1 - p)^k_retries per step',
          checkQuestion: {
            question:
              'Why does an effective learning harness store learned propositions in a compact external Knowledge Graph rather than keeping one giant endless chat transcript?',
            options: [
              {
                text: 'Long transcripts bloat token cost per turn (O(T²)) and degrade attention focus ("context rot"), whereas a compact graph shares only the relevant prerequisite structure across fresh sessions.',
                diagnosticFeedback:
                  'Exactly—compacting sessions into structured propositions keeps every new session fast, cheap, and sharply focused.',
              },
              {
                text: 'Because JSON files execute Python code automatically without a CPU.',
                misconceptionTag: 'json-execution-myth',
                diagnosticFeedback: 'JSON is passive structured data read into the prompt context selectively.',
              },
              {
                text: 'Because LLMs cannot read more than 50 words per prompt.',
                misconceptionTag: 'context-limit-exaggeration',
                diagnosticFeedback: 'Modern LLMs have large context windows, but filling them with raw chat logs wastes money and hurts retrieval precision.',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'What are the core architectural components that distinguish an Agent Harness from a raw LLM chat window?',
            options: [
              {
                text: 'Persistent external memory (knowledge graph), dependency planning (minimal tree), tool/check verification gates after each step, and context compaction.',
                misconception: 'None',
                explanation: 'The harness controls context, tools, verification, and memory around the model.',
              },
              {
                text: 'Modifying the floating-point weights of the neural network on every user keystroke.',
                misconception: 'Confusing harness engineering with online weight fine-tuning.',
                explanation: 'Harnesses operate at inference time through context, state, and control loops without mutating model weights.',
              },
              {
                text: 'Replacing the tokenizer with an HTML parser.',
                misconception: 'Tokenizer confusion.',
                explanation: 'The model still uses its native tokenizer.',
              },
              {
                text: 'Disabling all system prompts so the model guesses what to do.',
                misconception: 'Opposite of harness design.',
                explanation: 'Harnesses rely on disciplined, modular system prompts and state contracts.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'During a practice session, a student asks for a hint. Tutor A immediately prints the full worked solution and moves to the next question. Tutor B checks the student’s thinking trace, identifies the first broken step, and gives an R1 pattern nudge.',
            confusableWith: 'Answer-dumping chatbot vs. Harness-enforced Minimal Hint Ladder (R0–R5)',
            question:
              'Why does Tutor A destroy the learning yield of the practice problem?',
            options: [
              {
                text: 'Revealed information cannot be unrevealed: dumping the full solution surrenders the retrieval and execution events, producing an illusion of competence (familiarity) instead of unaided recall.',
                whyRightOrWrong:
                  'Exact LearnHarness Practice Doctrine: strengthening only comes from retrieval that succeeds with effort!',
              },
              {
                text: 'Because printing a full solution uses fewer tokens than printing a short R1 nudge.',
                whyRightOrWrong: 'Actually, a short R1 surgical nudge uses far *fewer* output tokens AND preserves learning!',
              },
              {
                text: 'Because students never read full solutions.',
                whyRightOrWrong: 'Students read them and nod along ("that makes sense"), which is the classic familiarity trap.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'Name the four stages of the LearnHarness loop, explain why checks happen after every single reasoning step, and state the Inactivity Constraint in practice.',
            acceptedKeywords: ['probe', 'plan', 'teach', 'practice', 'single step', 'inactivity', 'interleav'],
            canonicalAnswer:
              'Probe -> Plan -> Teach -> Practice; single-step checks catch and repair misconceptions before downstream steps build on them; the Inactivity Constraint requires interleaving so propositions must be retrieved cold.',
            hints: [
              'R0: Recall the 4 stages from measuring understanding to drilling retrieval.',
              'R1: Stage 1 brackets what you know; Stage 2 builds the minimal tree; Stage 3 steps through it; Stage 4 drills it.',
              'R2: Why check after *every* reasoning step instead of at the end of a 5-step lecture?',
              'R3: Proposition: Probe -> Plan -> Teach -> Practice; per-step checks localize errors immediately; practice interleaves topics so the target proposition starts inactive.',
              'R4: Write: (1) Probe, Plan, Teach, Practice; (2) Single-step checks prevent building on broken foundations; (3) Inactivity constraint = target must not already be active in working memory.',
              'R5: Complete answer: The 4 stages are Probe, Plan, Teach, and Practice. Checking every step catches errors immediately before corrupting later derivations, and the Inactivity Constraint interleaves problems so concepts are retrieved cold.',
            ],
          },
          application: {
            examProblem:
              'Suppose a student has a 20% chance of misunderstanding any single reasoning step (p = 0.80 success per step). Compare a 5-step monolithic explanation (checked only at the end) against a 5-step harness loop that checks and repairs each step immediately. How does this also reduce token waste?',
            feynmanPrompt:
              'Explain mathematically why checking every small step beats lecturing for 2 pages and asking "Got it?" at the end.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Compute monolithic success probability: 0.80^5 = 0.3277 (~33% chance the whole 5-step chain lands cleanly)',
                keywords: ['0.8', '0.32', '33%', '32.8%', 'power', 'monolithic'],
              },
              {
                id: 'm2',
                label: 'Explain that in a monolithic lecture, a failure at step 2 invalidates steps 3, 4, and 5, whereas per-step checking localizes and repairs step 2 before step 3 is taught',
                keywords: ['localize', 'repair', 'corrupt', 'step 2', 'before', 'foundation'],
              },
              {
                id: 'm3',
                label: 'Connect to token efficiency: short node-scoped turns + external graph memory avoid re-sending and re-generating long failed explanations',
                keywords: ['token', 'cost', 'graph', 'short', 'waste', 'context'],
              },
            ],
            modelSolution:
              '1) In a 5-step unchecked lecture where each step lands independently with probability p = 0.80, the probability that all 5 steps land is 0.80^5 = 0.32768 (~32.8%—meaning 67.2% of sessions fail!). 2) Worse, when step 2 fails, steps 3–5 are built on a broken premise, so the learner cannot even tell *where* they got lost. Per-step checking verifies step 2 immediately and repairs it with a 1-line surgical nudge before advancing. 3) By storing verified propositions in an external Knowledge Graph and keeping turns short, the harness avoids regenerating multi-paragraph lectures and keeps prompt context compact.',
            commonTraps: [
              'Adding probabilities instead of multiplying 0.80^5 for sequential dependent steps',
              'Forgetting that an unrepaired failure at step 2 makes steps 3–5 impossible to absorb',
            ],
            hints: [
              'R0: Calculate 0.8^5 for 5 dependent steps landing without error.',
              'R1: What is 0.8 × 0.8 × 0.8 × 0.8 × 0.8?',
              'R2: It is 0.3277 (~33%). That means 2 out of 3 times, a 5-step monologue fails!',
              'R3: Now contrast repairing a single step vs. debugging where a 5-step chain broke, and how external graph state saves tokens.',
              'R4: State: (1) 0.8^5 ≈ 32.8% monolithic success; (2) per-step check localizes failure immediately; (3) graph compaction prevents token bloat.',
              'R5: Complete answer: Unchecked 5-step lectures succeed only 0.8^5 ≈ 32.8% of the time and corrupt steps after the first miss. Per-step verification repairs each link immediately and stores verified claims in a compact graph, slashing wasted tokens.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'bio-premed-energetics',
    code: 'BIO 202 / MCAT',
    title: 'Cellular Energetics, Enzyme Kinetics & Membrane Potentials',
    institutionTag: 'Pre-Med & Biochemistry · Exam Pack',
    examTitle: 'Midterm 2: Thermodynamics, Michaelis-Menten & Electrophysiology',
    description:
      'High-yield pre-med mastery pack covering Gibbs Free Energy vs. Kinetics, Competitive vs. Non-Competitive Inhibition, Chemiosmotic Uncouplers, and the Nernst/Goldman equations.',
    lastUpdated: '2026-11-09',
    units: [
      {
        id: 'u1-kinetics',
        number: 1,
        title: 'Unit 1: Bioenergetics & Michaelis-Menten Kinetics',
        subtitle: 'Thermodynamic spontaneity (ΔG) versus catalytic rate (E_a, K_m, V_max)',
        examSharePercent: 55,
        primingSummary:
          'Never confuse WHETHER a reaction wants to happen (thermodynamics: ΔG, K_eq) with HOW FAST it happens (kinetics: activation barrier E_a, enzymes). Enzymes are pure speed catalysts—they never alter ΔG!',
        unconditionalTruthSummary:
          'ΔG depends ONLY on the free-energy difference between final products and initial reactants; an enzyme lowers the transition-state activation barrier E_a equally in both directions.',
      },
      {
        id: 'u2-membranes',
        number: 2,
        title: 'Unit 2: Chemiosmotic Coupling & Membrane Potentials',
        subtitle: 'Proton-motive force in mitochondria and Nernst equilibrium across ion channels',
        examSharePercent: 45,
        primingSummary:
          'Both ATP synthesis and neuronal action potentials run on the same physical engine: storing potential energy as an electrochemical ion gradient across an impermeable lipid bilayer.',
        unconditionalTruthSummary:
          'Ions flow spontaneously down their electrochemical gradient until the electrical voltage across the membrane exactly balances the chemical concentration gradient (Nernst equilibrium).',
      },
    ],
    nodes: [
      {
        id: 'delta-g-vs-activation-energy',
        unitId: 'u1-kinetics',
        title: 'Thermodynamics (ΔG, K_eq) vs. Catalytic Kinetics (E_a)',
        statement:
          'An enzyme stabilizes the high-energy transition state to lower activation energy E_a (accelerating both forward and reverse rates equally), but never changes ΔG or the equilibrium constant K_eq.',
        isUnconditionalTruth: true,
        prerequisites: [],
        examWeight: 5,
        motivatedHook:
          'Glucose oxidation (ΔG°\' = -2870 kJ/mol) is massively spontaneous, yet a bowl of sugar sits on your table for years without bursting into flames. Why doesn’t a negative ΔG mean a fast reaction?',
        predictionPrompt: {
          question:
            'If a biochemical reaction has ΔG = +15 kJ/mol (endergonic / uphill), what happens if you add a 10× concentration of a highly specific enzyme (with no ATP coupled)?',
          options: [
            'Nothing changes in the net direction — the enzyme cannot make an uphill (+ΔG) reaction spontaneous; it only helps the system reach its existing equilibrium faster',
            'The enzyme flips ΔG from +15 kJ/mol to -15 kJ/mol so the reaction proceeds forward',
            'The enzyme increases K_eq by 10×',
            'The enzyme gets consumed as a reactant to supply the missing 15 kJ/mol',
          ],
          correctIndex: 0,
          resolution:
            'Spot on! ΔG = G_products - G_reactants is a state function. Because an enzyme does not change the energy of reactants or products, it cannot change ΔG or K_eq = exp(-ΔG°/RT)!',
        },
        teachingStep: {
          coreExplanation:
            'Gibbs free energy ΔG = G_products - G_reactants determines spontaneity (ΔG < 0) and equilibrium ratio K_eq = [P]_eq/[S]_eq = e^{-ΔG°/RT}. Activation energy E_a = G_{transition}^\ddagger - G_{reactants} is the hill between them. An enzyme’s active site binds the *transition state* more tightly than the ground-state substrate, lowering G_{transition}^\ddagger. Because the ceiling drops by ΔE_a while both floors (G_reactants and G_products) stay fixed, both forward and reverse rate constants k_f and k_r increase by the exact same factor e^{ΔE_a/RT}, leaving K_eq = k_f / k_r completely unchanged!',
          visualMentalModel:
            'Energy ^       ..--.. (Uncatalyzed Transition State E_a)\n       |     /        \\\n       |    /  .--.    \\  <-- Enzyme lowers peak E_a ONLY\n       | [S]--\'    \'\\   \\\n       |             \'--[P]  (ΔG = G_P - G_S is 100% UNCHANGED!)',
          keyFormulaOrRule: 'ΔG° = -RT ln(K_eq)   |   k = A e^{-E_a / RT}   |   K_eq = k_forward / k_reverse',
          checkQuestion: {
            question:
              'If an enzyme increases the forward rate constant k_forward by a factor of 1,000,000 (10^6), by what factor does it change the reverse rate constant k_reverse and K_eq?',
            options: [
              {
                text: 'k_reverse ALSO increases by 10^6, and K_eq = k_forward / k_reverse changes by a factor of 1 (unchanged).',
                diagnosticFeedback:
                  'Classic MCAT trap conquered! Lowering the transition state peak lowers the barrier from both sides by the exact same ΔE_a.',
              },
              {
                text: 'k_reverse decreases by 10^6, so K_eq increases by 10^{12}.',
                misconceptionTag: 'one-way-catalyst-myth',
                diagnosticFeedback: 'If K_eq changed without adding energy, you could build a perpetual motion machine!',
              },
              {
                text: 'k_reverse stays unchanged, so K_eq increases by 10^6.',
                misconceptionTag: 'equilibrium-shift-myth',
                diagnosticFeedback: 'Enzymes accelerate equilibration in both directions equally.',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'Which set of parameters is altered when an enzyme is added to a reversible biochemical reaction?',
            options: [
              {
                text: 'Activation energy (E_a), transition-state free energy (G‡), forward rate (k_f), and reverse rate (k_r).',
                misconception: 'None',
                explanation: 'All kinetic barrier parameters change, while thermodynamic state functions (ΔG, ΔH, K_eq) stay constant.',
              },
              {
                text: 'Gibbs free energy change (ΔG) and equilibrium constant (K_eq).',
                misconception: 'Confusing kinetics with thermodynamics.',
                explanation: 'State functions depend only on initial and final states, not the pathway.',
              },
              {
                text: 'Standard enthalpy change (ΔH°) and product ground-state energy.',
                misconception: 'Thinking enzymes stabilize products rather than the transition state.',
                explanation: 'Enzymes stabilize the transition state, not the free reactants or products.',
              },
              {
                text: 'Only the forward rate constant k_f; the reverse rate k_r is unaffected.',
                misconception: 'Forgetting microscopic reversibility.',
                explanation: 'Both k_f and k_r increase by the exact same multiplicative factor.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'A mutant enzyme is engineered so that its active site binds the ground-state substrate S 100× tighter (lowering G_S), without changing the energy of the transition state G‡.',
            confusableWith: 'Transition-state stabilization vs. Ground-state substrate over-stabilization ( Thermodynamic Pit)',
            question:
              'How does this mutation affect the catalytic rate k_cat compared to the wild-type enzyme?',
            options: [
              {
                text: 'It SLOWS DOWN catalysis! Lowering the substrate energy G_S while G‡ stays fixed actually INCREASES the activation barrier E_a = G‡ - G_S (creating a thermodynamic trap).',
                whyRightOrWrong:
                  'Brilliant insight! Enzymes must be complementary to the *transition state*, not overly comfy traps for the ground-state substrate.',
              },
              {
                text: 'It speeds up k_cat by 100× because tighter substrate binding always lowers E_a.',
                whyRightOrWrong: 'Deepening the reactant well increases the climb from ES to ES‡!',
              },
              {
                text: 'It makes ΔG of the overall reaction 100× more negative.',
                whyRightOrWrong: 'Free S and P in solution still have the same ΔG.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'State what an enzyme stabilizes to lower E_a, why K_eq remains invariant, and what happens if an enzyme over-stabilizes the ground-state substrate instead of the transition state.',
            acceptedKeywords: ['transition state', 'k_eq', 'both', 'forward', 'reverse', 'barrier', 'delta g', 'Δg'],
            canonicalAnswer:
              'Enzymes stabilize the transition state to lower E_a, multiplying k_f and k_r equally so K_eq = k_f/k_r and ΔG stay unchanged; over-stabilizing ground-state ES deepens the energy well and increases E_a.',
            hints: [
              'R0: Distinguish the peak of the reaction coordinate (G‡) from the endpoints (G_S and G_P).',
              'R1: Write K_eq in terms of k_forward and k_reverse.',
              'R2: If the peak G‡ drops by ΔE_a, what happens to the barrier from S to G‡ AND from P to G‡?',
              'R3: Proposition: Stabilizing G‡ lowers E_a equally in both directions (leaving ΔG and K_eq fixed), whereas lowering G_ES increases the climb to G‡.',
              'R4: State: (1) Transition-state stabilization lowers E_a; (2) k_f and k_r increase equally => K_eq and ΔG unchanged; (3) Ground-state trap raises E_a.',
              'R5: Complete answer: Enzymes bind the transition state to lower E_a, scaling k_f and k_r by the same factor so ΔG and K_eq are unchanged. Over-stabilizing ground-state ES increases the barrier E_a = G‡ - G_ES.',
            ],
          },
          application: {
            examProblem:
              'At 310 K (RT ≈ 2.58 kJ/mol), an uncatalyzed reaction has E_a = 80 kJ/mol and ΔG°\' = -20 kJ/mol. An enzyme lowers the transition state energy by 25.8 kJ/mol. (1) By what factor does the reaction rate increase? (2) What is the new ΔG°\'? (3) What is the activation energy of the catalyzed REVERSE reaction?',
            feynmanPrompt:
              'Walk a classmate through the exact numbers of a reaction coordinate diagram so they never mix up ΔG, forward E_a, and reverse E_a on an exam.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Compute rate speedup factor: exp(ΔE_a / RT) = exp(25.8 / 2.58) = e^{10} ≈ 22,026× faster',
                keywords: ['e^10', 'e^{10}', '22026', '22,026', 'exp', '10'],
              },
              {
                id: 'm2',
                label: 'State that new ΔG°\' remains -20 kJ/mol because enzymes do not alter reactant or product free energies',
                keywords: ['-20', 'unchanged', 'same', 'state function'],
              },
              {
                id: 'm3',
                label: 'Calculate catalyzed reverse E_a: new forward E_a = 80 - 25.8 = 54.2 kJ/mol; since products sit 20 kJ/mol below reactants, reverse E_a = 54.2 - (-20) = 74.2 kJ/mol',
                keywords: ['54.2', '74.2', 'reverse', '80 - 25.8'],
              },
            ],
            modelSolution:
              '1) Rate speedup = e^{ΔE_a / RT} = e^{25.8 / 2.58} = e^{10} ≈ 2.2 × 10^4 (22,026× faster). 2) ΔG°\' remains -20 kJ/mol (thermodynamic state function is untouched by catalysis). 3) Uncatalyzed forward E_a is 80 kJ/mol, so catalyzed forward E_a = 80 - 25.8 = 54.2 kJ/mol. Since products lie 20 kJ/mol lower than reactants (ΔG°\' = -20), climbing backward from products to the catalyzed peak requires E_{a,rev} = 54.2 + 20 = 74.2 kJ/mol (which is also 100 - 25.8 = 74.2 kJ/mol).',
            commonTraps: [
              'Subtracting 25.8 kJ/mol from ΔG°\' (-20 kJ/mol)',
              'Subtracting 20 from 54.2 instead of adding 20 when climbing from the lower-energy product state back to the peak',
            ],
            hints: [
              'R0: Sketch the energy levels: Reactants at 0, Products at -20, Uncatalyzed Peak at +80.',
              'R1: Lower the Peak by 25.8 kJ/mol: the new Peak sits at +54.2 kJ/mol.',
              'R2: For part (1), divide ΔE_a = 25.8 by RT = 2.58 to get the exponent in e^{ΔE_a/RT}.',
              'R3: For part (3), measure the vertical distance from Products (-20) up to the new Peak (+54.2).',
              'R4: Combine: (1) e^{10} ≈ 22,026x speedup; (2) ΔG°\' = -20 kJ/mol unchanged; (3) E_{a,rev} = 54.2 - (-20) = 74.2 kJ/mol.',
              'R5: Full solution: Speedup is e^{25.8/2.58} = e^{10} ≈ 22,026×. ΔG°\' stays -20 kJ/mol. Catalyzed peak is at +54.2 kJ/mol, so reverse barrier from products (-20) to peak (+54.2) is 74.2 kJ/mol.',
            ],
          },
        },
      },
      {
        id: 'michaelis-menten-inhibition',
        unitId: 'u1-kinetics',
        title: 'Michaelis-Menten (K_m, V_max) & Competitive vs. Non-Competitive Inhibition',
        statement:
          'Competitive inhibitors compete with substrate at the active site (raising apparent K_m while high [S] still reaches the same V_max); pure non-competitive inhibitors bind an allosteric site equally on E and ES (lowering apparent V_max without changing K_m).',
        isUnconditionalTruth: false,
        prerequisites: ['delta-g-vs-activation-energy'],
        examWeight: 5,
        motivatedHook:
          'Why can emergency doctors save a patient who drank methanol (wood alcohol) just by infusing massive amounts of regular ethanol, yet no amount of substrate rescues an enzyme poisoned by heavy metals at an allosteric site?',
        predictionPrompt: {
          question:
            'If an inhibitor binds ONLY to the active site (competing directly with substrate S), what happens to the reaction velocity v as you flood the cell with an infinitely huge concentration of substrate ([S] → ∞)?',
          options: [
            'Substrate molecules outnumber the inhibitor by millions to one, so every active site becomes occupied by S and the reaction still reaches the normal V_max!',
            'The velocity drops to zero because competitive inhibitors permanently destroy the active site',
            'V_max is cut in half regardless of how much substrate you add',
            'K_m decreases to zero',
          ],
          correctIndex: 0,
          resolution:
            'Spot on! Because competitive binding is reversible at the active site, flooding with [S] → ∞ outcompetes the inhibitor, leaving V_max unchanged—it just takes *more* [S] to reach half-maximal speed (apparent K_m increases by α = 1 + [I]/K_i)!',
        },
        teachingStep: {
          coreExplanation:
            'In Michaelis-Menten kinetics, v = (V_max [S]) / (K_m + [S]), where V_max = k_cat [E]_total is the saturated speed when 100% of enzymes hold S, and K_m is the substrate concentration [S] where v = ½ V_max (an inverse measure of affinity). (1) Competitive Inhibitor: binds free E at the active site. Flooding [S] → ∞ still saturates all E into ES, so V_max is UNCHANGED, but apparent K_m increases to αK_m (Lines intersect on the y-axis 1/V_max in a Lineweaver-Burk plot). (2) Pure Non-Competitive Inhibitor: binds an allosteric site with equal affinity for E and ES. Substrate binding affinity is untouched (K_m UNCHANGED), but a fraction 1/α of enzymes are rendered catalytically dead, reducing apparent V_max to V_max / α (Lines intersect on the x-axis -1/K_m).',
          visualMentalModel:
            'Competitive (Active Site):     V_max = Same      | K_m_app = α K_m (↑) | Flood with [S] rescues!\nNon-Competitive (Allosteric):  V_max_app = V/α (↓)| K_m = Same          | Flooding [S] CANNOT rescue!',
          keyFormulaOrRule:
            'v = (V_max [S]) / (α K_m + [S]) [Competitive]   vs.   v = ((V_max/α) [S]) / (K_m + [S]) [Non-Competitive]',
          checkQuestion: {
            question:
              'On a double-reciprocal Lineweaver-Burk plot (y = 1/v vs. x = 1/[S]), how can you immediately tell a Competitive inhibitor from a Non-Competitive inhibitor?',
            options: [
              {
                text: 'Competitive inhibition lines intersect on the y-axis (same 1/V_max, steeper slope αK_m/V_max); Non-Competitive lines intersect on the x-axis (same -1/K_m, higher y-intercept α/V_max).',
                diagnosticFeedback:
                  'Boom! Because y-intercept is 1/V_max and x-intercept is -1/K_m, the invariant parameter pins the intersection point.',
              },
              {
                text: 'Competitive lines are parallel; Non-Competitive lines curve downward.',
                misconceptionTag: 'uncompetitive-confusion',
                diagnosticFeedback: 'Parallel Lineweaver-Burk lines are the signature of Uncompetitive inhibition (binds ES only, decreasing both K_m and V_max equally)!',
              },
              {
                text: 'Competitive lines intersect on the x-axis; Non-Competitive intersect on the y-axis.',
                misconceptionTag: 'axis-swap-trap',
                diagnosticFeedback: 'Remember: y-axis is 1/v (so y-intercept = 1/V_max); x-axis is 1/[S] (so x-intercept = -1/K_m).',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'How do Competitive and Pure Non-Competitive inhibitors affect apparent K_m and V_max?',
            options: [
              {
                text: 'Competitive: K_m increases, V_max unchanged. Non-Competitive: K_m unchanged, V_max decreases.',
                misconception: 'None',
                explanation: 'Competitive dilutes active-site availability at low [S]; Non-Competitive reduces the pool of functional enzyme molecules.',
              },
              {
                text: 'Competitive: K_m decreases, V_max increases. Non-Competitive: K_m increases, V_max unchanged.',
                misconception: 'Inverted K_m affinity confusion.',
                explanation: 'Lower affinity means a *higher* [S] is needed to reach ½ V_max, so K_m increases.',
              },
              {
                text: 'Both decrease V_max and increase K_m identically.',
                misconception: 'Failing to separate active-site vs allosteric binding.',
                explanation: 'High [S] overcomes competitive inhibition at the active site.',
              },
              {
                text: 'Competitive: K_m unchanged, V_max decreases. Non-Competitive: K_m increases, V_max unchanged.',
                misconception: 'Swapped definitions.',
                explanation: 'Active-site competition changes K_m; allosteric inactivation changes V_max.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'Drug X binds ONLY to the enzyme-substrate complex (ES) and cannot bind free enzyme (E). When Drug X is added, both V_max and apparent K_m decrease by the exact same factor α.',
            confusableWith: 'Uncompetitive Inhibition (ES-only) vs. Competitive (E-only) & Non-Competitive (E and ES)',
            question:
              'What type of inhibition is Drug X, and why does apparent K_m *decrease* (look like higher affinity)?',
            options: [
              {
                text: 'Uncompetitive inhibition: by locking ES into an dead-end ESI complex, Le Chatelier’s principle pulls E + S → ES forward, lowering the [S] needed to half-saturate the enzyme (lower K_m) while also lowering V_max.',
                whyRightOrWrong:
                  'Spot on! Locking up ES depletes free E, so apparent affinity rises (K_m drops by α) right alongside V_max dropping by α, producing parallel Lineweaver-Burk lines.',
              },
              {
                text: 'Competitive inhibition, because any decrease in K_m means the active site was blocked.',
                whyRightOrWrong: 'Blocking the active site increases K_m, not decreases it.',
              },
              {
                text: 'Allosteric activation, because lower K_m always increases V_max.',
                whyRightOrWrong: 'Here V_max decreases because ESI cannot form product!',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'State the effect of (1) Competitive, (2) Non-Competitive, and (3) Uncompetitive inhibitors on K_m, V_max, and their Lineweaver-Burk plot geometry.',
            acceptedKeywords: ['competitive', 'v_max', 'k_m', 'y-axis', 'x-axis', 'parallel', 'uncompetitive'],
            canonicalAnswer:
              'Competitive: K_m ↑, V_max same (y-axis intersection); Non-competitive: K_m same, V_max ↓ (x-axis intersection); Uncompetitive: both K_m ↓ and V_max ↓ equally (parallel lines).',
            hints: [
              'R0: Recall what 1/V_max (y-intercept) and -1/K_m (x-intercept) represent on a Lineweaver-Burk plot.',
              'R1: Which inhibitor can be outcompeted by infinite [S] (keeping V_max constant)?',
              'R2: Which inhibitor acts like removing a fraction of active enzyme without touching substrate binding (keeping K_m constant)?',
              'R3: Proposition: Competitive = K_m↑, V_max same (y-axis cross); Non-competitive = K_m same, V_max↓ (x-axis cross); Uncompetitive = K_m↓, V_max↓ (parallel).',
              'R4: Write out all 3 cases with their K_m, V_max shifts and Lineweaver-Burk intersections.',
              'R5: Complete answer: Competitive raises K_m, keeps V_max constant (intersects on y-axis). Non-competitive keeps K_m constant, lowers V_max (intersects on x-axis). Uncompetitive lowers both K_m and V_max by α (parallel lines).',
            ],
          },
          application: {
            examProblem:
              'An enzyme has V_max = 100 μmol/min and K_m = 2 mM. In the presence of 6 mM of Inhibitor Z (K_i = 2 mM), adding [S] = 16 mM yields v = 50 μmol/min, while flooding with [S] = 10,000 mM reaches v ≈ 100 μmol/min. (1) Identify Inhibitor Z’s mechanism. (2) Verify the factor α = 1 + [I]/K_i and apparent K_m. (3) What would v be at [S] = 10,000 mM if Inhibitor Z were Pure Non-Competitive with the same α?',
            feynmanPrompt:
              'Teach a pre-med friend how to solve any Michaelis-Menten inhibitor math problem in 30 seconds using the α factor.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Identify Competitive Inhibition because flooding with [S] = 10,000 mM restores the full V_max = 100 μmol/min',
                keywords: ['competitive', 'v_max', '100', 'flood', 'restore'],
              },
              {
                id: 'm2',
                label: 'Calculate α = 1 + [I]/K_i = 1 + 6/2 = 4, giving apparent K_m = α K_m = 4 × 2 mM = 8 mM (so at [S]=8 mM, v=50; or check v = 100·16/(8+16) = 66.7)',
                keywords: ['alpha', 'α = 4', '4', '8 mm', '1 + 6/2'],
              },
              {
                id: 'm3',
                label: 'Show that if Non-Competitive with α = 4, flooding with [S] → ∞ would cap out at V_max,app = V_max / α = 100 / 4 = 25 μmol/min',
                keywords: ['25', '100 / 4', '100/4', 'non-competitive', 'cap'],
              },
            ],
            modelSolution:
              '1) Because saturating substrate ([S] = 10,000 mM) recovers the full uninhibited V_max = 100 μmol/min, Inhibitor Z is a Competitive Inhibitor. 2) With [I] = 6 mM and K_i = 2 mM, the inhibition factor is α = 1 + [I]/K_i = 1 + 6/2 = 4. Thus apparent K_m = α K_m = 4 × 2 mM = 8 mM. 3) If Z were a Pure Non-Competitive inhibitor with α = 4, substrate flooding could not displace it from the allosteric site, so the maximum velocity at [S] = 10,000 mM would be V_max,app = V_max / α = 100 / 4 = 25 μmol/min.',
            commonTraps: [
              'Computing α = [I]/K_i = 3 instead of 1 + [I]/K_i = 4',
              'Thinking high [S] can rescue a Non-Competitive inhibitor',
            ],
            hints: [
              'R0: Look at what happens when [S] = 10,000 mM: v reaches 100 μmol/min (the original V_max!).',
              'R1: Compute α = 1 + [I]/K_i for [I] = 6 mM and K_i = 2 mM.',
              'R2: α = 1 + 3 = 4! So K_m,app = 4 × 2 mM = 8 mM.',
              'R3: Now for a Non-Competitive inhibitor with α = 4, divide V_max by α.',
              'R4: State: (1) Competitive (full V_max recovered); (2) α = 4, K_m,app = 8 mM; (3) Non-competitive V_max,app = 100/4 = 25 μmol/min.',
              'R5: Complete answer: Recovering V_max = 100 at high [S] proves Competitive inhibition. α = 1 + 6/2 = 4, so K_m,app = 8 mM. Under Non-Competitive inhibition with α = 4, V_max,app = 100/4 = 25 μmol/min.',
            ],
          },
        },
      },
      {
        id: 'chemiosmotic-uncouplers',
        unitId: 'u2-membranes',
        title: 'Proton-Motive Force, ATP Synthase & Mitochondrial Uncouplers (DNP / UCP1)',
        statement:
          'Electron transport pumps H+ out of the matrix to build an electrochemical proton gradient; uncouplers (like 2,4-DNP or thermogenin UCP1) permeabilize the inner membrane to H+, collapsing ATP synthesis while accelerating electron transport, O2 consumption, and heat release.',
        isUnconditionalTruth: false,
        prerequisites: ['delta-g-vs-activation-energy'],
        examWeight: 5,
        motivatedHook:
          'When cells are poisoned with 2,4-DNP, ATP production plummets to zero—yet the patient’s oxygen consumption and body temperature skyrocket! Why does stopping ATP synthesis make the Electron Transport Chain run FASTER?',
        predictionPrompt: {
          question:
            'If a hydrophobic weak acid (uncoupler) punches proton-leak channels into the inner mitochondrial membrane so H+ flows freely back into the matrix without passing through ATP Synthase, what happens to the rate of NADH oxidation and O2 consumption?',
          options: [
            'NADH oxidation and O2 consumption SPEED UP dramatically because the proton back-pressure opposing Complex I, III, and IV is removed, releasing the gradient energy entirely as heat',
            'O2 consumption stops immediately because Complex IV requires ATP to reduce oxygen',
            'Nothing changes in O2 consumption',
            'The inner membrane freezes solid',
          ],
          correctIndex: 0,
          resolution:
            'Yes! Normally, a high H+ gradient creates thermodynamic back-pressure against pumping more H+. Draining the gradient removes that back-pressure, so the ETC races at maximum speed while dumping ΔG as pure heat!',
        },
        teachingStep: {
          coreExplanation:
            'Oxidative phosphorylation couples two processes across the impermeable inner mitochondrial membrane: (1) Complexes I, III, and IV oxidize NADH/FADH2 and reduce O2 → H2O, pumping H+ into the intermembrane space to establish the Proton-Motive Force (Δp = Δψ + ΔpH). (2) Complex V (ATP Synthase) lets H+ flow back down its gradient to drive ADP + P_i → ATP. Contrast two poisons: (A) ATP Synthase Blocker (Oligomycin): blocks the H+ return chute -> H+ gradient builds to maximum back-pressure -> ETC and O2 consumption HALT. (B) Uncoupler (2,4-DNP, high-dose Aspirin, brown fat UCP1): lets H+ leak across the membrane -> H+ gradient collapses -> ATP synthesis drops, back-pressure vanishes -> ETC, NADH oxidation, O2 consumption, and HEAT production skyrocket!',
          visualMentalModel:
            'Oligomycin (Blocks Complex V): H+ Gradient ↑↑ (Max Back-Pressure) ──> ETC & O2 Consumption STOP  | ATP ↓↓\nUncoupler (DNP / UCP1 Leak):   H+ Gradient ↓↓ (No Back-Pressure)  ──> ETC & O2 Consumption RACE ↑↑ | ATP ↓↓ | HEAT ↑↑',
          keyFormulaOrRule:
            'Uncoupler: Δp (H+ gradient) → 0  ===>  ATP Synthesis ↓,  O2 Consumption ↑↑,  NADH/NAD+ ratio ↓,  Heat ↑↑',
          checkQuestion: {
            question:
              'In isolated mitochondria treated with Oligomycin (which completely blocks Complex V / ATP Synthase), oxygen consumption drops to near zero. What happens if you then add 2,4-DNP to those same mitochondria?',
            options: [
              {
                text: 'Oxygen consumption immediately resumes and spikes high (because DNP drains the H+ back-pressure via membrane leak), even though ATP synthesis remains zero.',
                diagnosticFeedback:
                  'Gold-standard experimental proof of Mitchell’s Chemiosmotic Theory!',
              },
              {
                text: 'ATP synthesis resumes at 100% normal rate.',
                misconceptionTag: 'atp-rescue-myth',
                diagnosticFeedback: 'Complex V is still blocked by Oligomycin, and the H+ gradient is drained by DNP, so no ATP is made.',
              },
              {
                text: 'Oxygen consumption stays zero because Oligomycin directly inhibits Complex IV.',
                misconceptionTag: 'direct-inhibition-myth',
                diagnosticFeedback: 'Oligomycin only blocks Complex V; the ETC only stopped because of H+ gradient back-pressure!',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'How does a mitochondrial uncoupler (such as 2,4-DNP or UCP1/thermogenin in brown adipose tissue) affect cellular metabolism?',
            options: [
              {
                text: 'Dissipates the proton gradient across the inner mitochondrial membrane, decreasing ATP production while increasing O2 consumption, NADH oxidation, and heat generation.',
                misconception: 'None',
                explanation: 'Without proton back-pressure, electron transport runs uninhibited and releases ΔG as thermal energy.',
              },
              {
                text: 'Directly inhibits Complex IV (cytochrome c oxidase), halting both O2 consumption and ATP synthesis.',
                misconception: 'Confusing uncouplers (DNP) with ETC inhibitors (Cyanide / CO).',
                explanation: 'Cyanide and CO block Complex IV (stopping O2 use); uncouplers accelerate O2 use.',
              },
              {
                text: 'Increases the proton gradient across the inner membrane, hyperpolarizing the matrix.',
                misconception: 'Confusing uncouplers with Oligomycin.',
                explanation: 'Oligomycin blocks ATP synthase and builds the gradient; uncouplers collapse the gradient.',
              },
              {
                text: 'Halts glycolysis and the citric acid cycle by accumulating high levels of ATP.',
                misconception: 'Direction of ATP change.',
                explanation: 'ATP levels drop (and AMP/ADP rise), which allosterically *activates* PFK-1, glycolysis, and the TCA cycle!',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'Two patients arrive at the ER with severe cellular ATP depletion. Patient A was exposed to Cyanide (CN⁻); Patient B ingested 2,4-DNP.',
            confusableWith: 'ETC Inhibitor (Cyanide) vs. Protonophore Uncoupler (2,4-DNP)',
            question:
              'How do venous blood O2 saturation, mitochondrial H+ gradient, and core body temperature distinguish Patient A from Patient B?',
            options: [
              {
                text: 'Patient A (Cyanide): Complex IV blocked → O2 cannot be consumed (bright red venous blood, high venous pO2), normal/low temperature. Patient B (DNP): ETC races unchecked → massive O2 consumption (low venous pO2), collapsed H+ gradient, severe hyperthermia (fever).',
                whyRightOrWrong:
                  'Complete clinical & biochemical mastery! Cyanide stops O2 reduction; DNP sends O2 consumption and heat into overdrive.',
              },
              {
                text: 'Both patients have zero O2 consumption and hypothermia because ATP depletion always halts Complex IV.',
                whyRightOrWrong: 'DNP increases O2 consumption and causes dangerous hyperthermia.',
              },
              {
                text: 'Patient A has hyperthermia and high O2 consumption; Patient B cannot consume O2.',
                whyRightOrWrong: 'That reverses Cyanide and DNP.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'Contrast the effect of (1) Uncouplers (DNP/UCP1), (2) Oligomycin, and (3) Cyanide on the H+ gradient, O2 consumption, and ATP synthesis.',
            acceptedKeywords: ['uncoupler', 'oligomycin', 'cyanide', 'gradient', 'o2', 'oxygen', 'heat', 'back-pressure'],
            canonicalAnswer:
              'Uncouplers: H+ gradient ↓, O2 consumption ↑↑ (heat ↑), ATP ↓. Oligomycin: H+ gradient ↑↑ (back-pressure), O2 consumption ↓, ATP ↓ (rescued as O2 consumption by adding DNP). Cyanide: blocks Complex IV so H+ gradient ↓, O2 consumption = 0, ATP ↓.',
            hints: [
              'R0: Separate the 3 targets: membrane H+ permeability (DNP), Complex V chute (Oligomycin), Complex IV electron exit (Cyanide).',
              'R1: What happens to H+ back-pressure when Complex V is plugged (Oligomycin) vs. when the membrane leaks H+ (DNP)?',
              'R2: If Cyanide blocks Complex IV directly, can electrons flow to O2 even if you add DNP?',
              'R3: Proposition: DNP leaks H+ (gradient↓, O2↑, heat↑); Oligomycin blocks Complex V (gradient↑, O2↓); Cyanide blocks Complex IV (gradient↓, O2=0).',
              'R4: Write out all 3 agents with their effect on (a) H+ gradient, (b) O2 consumption, and (c) ATP.',
              'R5: Complete answer: Uncouplers collapse the H+ gradient, accelerating O2 use and heat while stopping ATP. Oligomycin blocks ATP synthase, maxing out the H+ gradient and halting O2 use via back-pressure. Cyanide blocks Complex IV, stopping O2 use, H+ pumping, and ATP.',
            ],
          },
          application: {
            examProblem:
              'In a classic oxygraph experiment, isolated mitochondria have ADP and P_i present. You add: (Step 1) Succinate, (Step 2) Oligomycin, (Step 3) 2,4-DNP, and (Step 4) Cyanide. Predict the slope of the O2 concentration curve (rate of O2 consumption) at each of the 4 steps and explain why.',
            feynmanPrompt:
              'Explain the 4-step mitochondrial oxygraph trace using a hydroelectric dam analogy (water pump = ETC, reservoir = H+ gradient, turbine = ATP Synthase, hole in dam = DNP).',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Step 1 (Succinate + ADP): O2 drops steadily (active respiration via Complex II → III → IV coupled to ATP Synthase)',
                keywords: ['step 1', 'succinate', 'steady', 'consume', 'drop', 'active'],
              },
              {
                id: 'm2',
                label: 'Step 2 (Oligomycin): O2 curve flattens (consumption stops) because blocking ATP Synthase builds maximal H+ gradient back-pressure',
                keywords: ['step 2', 'oligomycin', 'flat', 'stop', 'back-pressure', 'gradient'],
              },
              {
                id: 'm3',
                label: 'Step 3 (2,4-DNP): O2 drops steeply (fastest consumption) as H+ leaks across the inner membrane; Step 4 (Cyanide): O2 flattens completely to 0 as Complex IV is directly blocked',
                keywords: ['step 3', 'dnp', 'steep', 'fast', 'step 4', 'cyanide', 'complex iv'],
              },
            ],
            modelSolution:
              '1) Step 1 (Succinate + ADP): FADH2 donates electrons at Complex II; Complexes III and IV pump H+ and consume O2 steadily while Complex V makes ATP (moderate downward O2 slope). 2) Step 2 (+Oligomycin): Complex V is blocked; H+ cannot return, so Δp reaches maximum back-pressure and O2 consumption halts (flat slope). 3) Step 3 (+2,4-DNP): DNP shuttles H+ across the inner membrane, collapsing the back-pressure; the ETC races at maximum uncoupled speed (steepest downward O2 slope, zero ATP, high heat). 4) Step 4 (+Cyanide): CN⁻ binds Fe³⁺ in Complex IV, blocking electron transfer to O2 directly; O2 consumption stops dead (flat slope) despite the leaky membrane.',
            commonTraps: [
              'Thinking DNP can restore O2 consumption *after* Cyanide has already blocked Complex IV',
              'Thinking Oligomycin increases O2 consumption',
            ],
            hints: [
              'R0: Use the dam analogy: ETC pumps water up; Oligomycin closes the turbine; DNP blows a hole in the dam wall; Cyanide cuts power to the pump.',
              'R1: Trace the O2 slope (flat vs downward vs steep downward) at Steps 1, 2, 3, and 4.',
              'R2: Why does DNP rescue O2 consumption after Oligomycin, whereas nothing rescues O2 consumption after Cyanide?',
              'R3: Combine all 4 steps: Step 1 steady drop -> Step 2 flat (back-pressure) -> Step 3 steep drop (uncoupled leak) -> Step 4 flat (Complex IV blocked).',
              'R4: Write out each step’s slope and the physical status of the H+ gradient and ETC.',
              'R5: Complete solution: Step 1 consumes O2 steadily; Step 2 (Oligomycin) flattens O2 slope via H+ back-pressure; Step 3 (DNP) causes rapid O2 drop by draining the H+ gradient; Step 4 (Cyanide) flattens O2 slope permanently by inhibiting Complex IV.',
            ],
          },
        },
      },
      {
        id: 'nernst-goldman-potentials',
        unitId: 'u2-membranes',
        title: 'Nernst Equilibrium vs. Goldman-Hodgkin-Katz Membrane Potential',
        statement:
          'Each ion has an equilibrium potential E_X = (61.5/z) log10([X]_out/[X]_in) where electrical force balances concentration diffusion; the cell’s resting potential V_m is a permeability-weighted average pulled closest to whichever ion has the highest membrane permeability (K+ at rest, Na+ at action potential peak).',
        isUnconditionalTruth: true,
        prerequisites: [],
        examWeight: 4,
        motivatedHook:
          'Inside a neuron, [K+] is 35× higher than outside, while [Na+] is 10× higher outside. Why is the resting neuron sitting at -70 mV instead of +60 mV, and how does opening a single gate flip the voltage in 1 millisecond?',
        predictionPrompt: {
          question:
            'If a membrane is ONLY permeable to K+ ions (and K+ is much more concentrated inside the cell than outside), what happens as K+ begins diffusing out down its concentration gradient?',
          options: [
            'Leaving K+ ions leave behind unbalanced negative anions inside, building an inside-negative voltage (≈ -90 mV) that pulls K+ back in until net flux reaches zero',
            'All K+ ions leave until [K+]_in = [K+]_out and the voltage stays 0 mV',
            'The inside of the cell becomes +90 mV positive',
            'ATP Synthase pumps K+ out to create the voltage',
          ],
          correctIndex: 0,
          resolution:
            'Spot on! Only a tiny fraction (~0.001%) of K+ needs to cross the membrane before the resulting inside-negative charge (-90 mV) pulls K+ back in just as hard as diffusion pushes it out—that balance point is the Nernst potential E_K!',
        },
        teachingStep: {
          coreExplanation:
            '1) Nernst Equation (Single Ion Equilibrium): For ion X with valence z at 37°C, E_X = (61.5 mV / z) log10([X]_out / [X]_in). Since [K+]_in ≈ 140 mM and [K+]_out ≈ 4 mM, E_K ≈ 61.5 log10(4/140) ≈ -90 mV. Since [Na+]_out ≈ 145 mM and [Na+]_in ≈ 14 mM, E_Na ≈ 61.5 log10(145/14) ≈ +62 mV. 2) Goldman-Hodgkin-Katz (Multi-Ion Reality): V_m is a tug-of-war weighted by relative permeability P_X. At rest, leak K+ channels dominate (P_K : P_Na ≈ 25 : 1), so V_m ≈ -70 mV (near E_K = -90 mV). During an action potential upstroke, voltage-gated Na+ channels fly open (P_Na ≫ P_K), pulling V_m sharply toward E_Na = +62 mV!',
          visualMentalModel:
            'E_K ≈ -90 mV <────── [Rest V_m = -70 mV (P_K ≫ P_Na)] ────────────────────── [Peak V_m = +40 mV (P_Na ≫ P_K)] ──> E_Na ≈ +62 mV',
          keyFormulaOrRule:
            'E_X = (61.5 mV / z) log10([X]_out / [X]_in)   |   Driving Force on X = V_m - E_X',
          checkQuestion: {
            question:
              'If a patient develops severe hyperkalemia (extracellular [K+]_out rises from 4 mM to 8 mM while [K+]_in stays 140 mM), how does the resting membrane potential V_m change?',
            options: [
              {
                text: 'Raising [K+]_out weakens the outward K+ concentration gradient, making E_K and V_m LESS negative (depolarizing the cell from -70 mV toward -55 mV).',
                diagnosticFeedback:
                  'Crucial physiology! Extracellular hyperkalemia depolarizes cardiac and neuronal membranes because [K+]_out / [K+]_in is less extreme.',
              },
              {
                text: 'V_m becomes MORE negative (hyperpolarizes to -110 mV) because K+ is a positive ion.',
                misconceptionTag: 'direction-of-gradient-trap',
                diagnosticFeedback: 'Adding positive K+ outside reduces the outward driving force for K+ to leave, so less negative charge is left behind inside!',
              },
              {
                text: 'V_m stays at -70 mV because only Na+ affects resting potential.',
                misconceptionTag: 'resting-ion-confusion',
                diagnosticFeedback: 'K+ has by far the highest permeability at rest, so V_m tracks changes in E_K closely.',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'What determines how close the resting membrane potential V_m sits to a specific ion’s Nernst potential E_X?',
            options: [
              {
                text: 'The ion’s relative membrane permeability P_X (conductance g_X): V_m is pulled closest to the Nernst potential of the most permeable ion.',
                misconception: 'None',
                explanation: 'In the Goldman equation, each ion’s concentration ratio is weighted by its permeability P_X.',
              },
              {
                text: 'Whichever ion has the largest atomic radius.',
                misconception: 'Irrelevant physical property.',
                explanation: 'Channel selectivity filters and open probability govern permeability.',
              },
              {
                text: 'The ion with zero permeability dominates V_m.',
                misconception: 'Opposite of GHK weighting.',
                explanation: 'If P_X = 0, ion X has zero weight in the Goldman equation.',
              },
              {
                text: 'The Nernst potential is always the arithmetic mean (E_K + E_Na) / 2.',
                misconception: 'Ignoring unequal permeabilities.',
                explanation: 'It is only the unweighted midpoint when P_K = P_Na.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'A divalent cation Ca²⁺ (valence z = +2) has [Ca²⁺]_out = 2 mM and [Ca²⁺]_in = 0.0002 mM (a 10,000 : 1 ratio). A student calculates E_Ca = 61.5 × log10(10,000) = +246 mV.',
            confusableWith: 'Monovalent (z = +1) vs. Divalent (z = +2) Nernst factor (61.5 / z)',
            question:
              'What error did the student make in computing E_Ca?',
            options: [
              {
                text: 'They forgot to divide by valence z = +2! Because each Ca²⁺ carries two positive charges, half as much voltage balances the same concentration ratio: E_Ca = (61.5 / 2) × 4 = +123 mV.',
                whyRightOrWrong:
                  'Exact catch! Always check the charge valence z in E_X = (61.5 / z) log10([X]_out / [X]_in).',
              },
              {
                text: 'They should have put [Ca²⁺]_in in the numerator and [Ca²⁺]_out in the denominator.',
                whyRightOrWrong: 'For a positive ion with [out] > [in], E_X is positive, so [out]/[in] is correct.',
              },
              {
                text: 'log10(10,000) is 10, not 4.',
                whyRightOrWrong: '10^4 = 10,000, so log10(10,000) = 4.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'Write the Nernst equation at 37°C, calculate E_Cl for Cl⁻ (z = -1) when [Cl⁻]_out = 110 mM and [Cl⁻]_in = 11 mM, and explain why opening Cl⁻ channels stabilizes a resting neuron at -70 mV.',
            acceptedKeywords: ['61.5', 'z', '-1', '-61.5', 'log', 'driving force', 'inhibitory', 'cl'],
            canonicalAnswer:
              'E_X = (61.5/z) log10([X]_out/[X]_in); for Cl⁻ (z = -1) with 110/11 = 10, E_Cl = (61.5/-1) log10(10) = -61.5 mV, clamping V_m near rest and opposing depolarization toward threshold.',
            hints: [
              'R0: Watch the sign of valence z = -1 for Chloride (Cl⁻)!',
              'R1: What is log10(110 / 11) = log10(10)?',
              'R2: Multiply (61.5 / -1) × 1.',
              'R3: Proposition: E_Cl = -61.5 mV; opening GABA_A Cl⁻ channels anchors V_m below action potential threshold (~-55 mV).',
              'R4: State: (1) E_X = (61.5/z) log10([out]/[in]); (2) E_Cl = -61.5 mV; (3) Anchors V_m against excitatory Na+ influx.',
              'R5: Complete answer: Using E_X = (61.5/z) log10([X]_out/[X]_in) with z = -1 and ratio 110/11 = 10 gives E_Cl = -61.5 mV. Increasing P_Cl clamps V_m near -61.5 mV, shunting depolarizing currents.',
            ],
          },
          application: {
            examProblem:
              'A neuron has E_K = -90 mV, E_Na = +60 mV, E_Cl = -70 mV, and resting potential V_m = -70 mV. (1) Calculate the electrochemical driving force (V_m - E_X) on K+, Na+, and Cl- at rest. (2) Which direction does each ion flow if its channels open at rest? (3) If P_K suddenly equals P_Na (1:1 ratio, P_Cl = 0), what does V_m become?',
            feynmanPrompt:
              'Teach a friend how V_m - E_X tells you the exact strength and direction of any ion current without memorizing a single chart.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Compute driving forces V_m - E_X at V_m = -70 mV: K+ = -70 - (-90) = +20 mV; Na+ = -70 - (+60) = -130 mV; Cl- = -70 - (-70) = 0 mV',
                keywords: ['+20', '20 mv', '-130', '130 mv', '0 mv', 'driving force'],
              },
              {
                id: 'm2',
                label: 'Determine flux directions: K+ flows OUT (small driving force +20 mV), Na+ rushes IN strongly (huge driving force -130 mV), Cl- has NO net flux (at equilibrium)',
                keywords: ['out', 'in', 'no net', 'equilibrium', 'rush'],
              },
              {
                id: 'm3',
                label: 'Compute equal-permeability midpoint: when P_K = P_Na, V_m = (E_K + E_Na)/2 = (-90 + 60)/2 = -15 mV',
                keywords: ['-15', '-15 mv', 'midpoint', 'average'],
              },
            ],
            modelSolution:
              '1) Driving force DF_X = V_m - E_X at V_m = -70 mV: For K+, DF_K = -70 - (-90) = +20 mV. For Na+, DF_Na = -70 - (+60) = -130 mV. For Cl⁻, DF_Cl = -70 - (-70) = 0 mV. 2) A positive driving force on a cation pushes it OUT (K+ leaks out weakly under +20 mV), a negative driving force pulls a cation IN (Na+ has a massive -130 mV inward driving force), and Cl⁻ is at exact equilibrium (0 mV, zero net flux). 3) When P_K = P_Na and P_Cl = 0, V_m sits halfway between E_K and E_Na: (-90 + 60) / 2 = -15 mV.',
            commonTraps: [
              'Thinking K+ has a larger driving force than Na+ at rest (K+ has high *permeability* at rest, but small +20 mV driving force; Na+ has low permeability at rest, but huge -130 mV driving force!)',
              'Getting the sign of (-70) - (-90) = +20 mV backwards',
            ],
            hints: [
              'R0: Plug V_m = -70 mV into DF_X = V_m - E_X for each of the three ions.',
              'R1: Watch double negatives: for K+, -70 - (-90) = +20 mV. What is -70 - (+60) for Na+?',
              'R2: Since V_m = -70 mV is already very close to E_K = -90 mV, which ion is far from its goal (+60 mV)?',
              'R3: For part (3), average -90 mV and +60 mV when P_K = P_Na.',
              'R4: State: (1) DF_K = +20 mV, DF_Na = -130 mV, DF_Cl = 0 mV; (2) K+ out, Na+ strongly in, Cl- net zero; (3) V_m = -15 mV at 1:1 permeability.',
              'R5: Complete answer: Driving forces at -70 mV are +20 mV (K+ flows out), -130 mV (Na+ flows strongly in), and 0 mV (Cl- at equilibrium). At P_K = P_Na, V_m = (-90 + 60)/2 = -15 mV.',
            ],
          },
        },
      },
    ],
  },
  {
    id: 'econ-game-probability',
    code: 'ECON 103 / STAT 210',
    title: 'Bayesian Inference, Expected Utility & Strategic Game Theory',
    institutionTag: 'Economics & Probability · Exam Pack',
    examTitle: 'Final Exam: Bayes Rule, Risk Aversion & Nash Equilibrium',
    description:
      'High-speed quantitative exam prep covering Base-Rate Neglect, Likelihood Ratios, Concave Expected Utility (Risk Aversion & Certainty Equivalents), and Nash Equilibria.',
    lastUpdated: '2026-11-09',
    units: [
      {
        id: 'u1-bayes',
        number: 1,
        title: 'Unit 1: Conditional Probability & Bayesian Updating',
        subtitle: 'Why P(A|B) ≠ P(B|A) and how prior base rates anchor diagnostic evidence',
        examSharePercent: 50,
        primingSummary:
          'When you see a positive test result, never look at accuracy in isolation: a 99% accurate test on a 1-in-10,000 rare event still produces 100 false alarms for every 1 true case!',
        unconditionalTruthSummary:
          'Conditioning restricts the sample space to events that actually occurred: P(Hypothesis | Evidence) equals True Positives divided by ALL Positives (True Positives + False Positives).',
      },
      {
        id: 'u2-utility-games',
        number: 2,
        title: 'Unit 2: Expected Utility, Risk Aversion & Nash Equilibrium',
        subtitle: 'Why diminishing marginal utility creates insurance markets and dominant strategies trap players',
        examSharePercent: 50,
        primingSummary:
          'People do not maximize expected dollars—they maximize expected utility u(w), where losing $1,000 hurts more than winning $1,000 feels good. In strategic games, each player best-responds to others’ actions.',
        unconditionalTruthSummary:
          'A concave utility function (u\'\'(w) < 0) means the utility of expected wealth exceeds expected utility of a gamble (Jensen’s Inequality), while a Nash Equilibrium is a profile where no player gains by deviating unilaterally.',
      },
    ],
    nodes: [
      {
        id: 'bayes-base-rate',
        unitId: 'u1-bayes',
        title: 'Bayes’ Theorem & Base-Rate Neglect (Posterior Odds Form)',
        statement:
          'P(D | +) = P(+ | D)P(D) / [P(+ | D)P(D) + P(+ | ¬D)P(¬D)]; in odds form, Posterior Odds = Prior Odds × Likelihood Ratio, proving that a tiny prior base rate P(D) can be outweighed by false positives even when sensitivity and specificity are 99%.',
        isUnconditionalTruth: true,
        prerequisites: [],
        examWeight: 5,
        motivatedHook:
          'A medical screening test is 99% sensitive and 99% specific. If you test positive for a disease that affects 1 in 1,000 college students, why is your actual chance of having the disease only ~9% instead of 99%?',
        predictionPrompt: {
          question:
            'Out of 1,000 people where 1 person has the disease (and tests positive) and 999 people are healthy (with a 1% false-positive rate), roughly how many total people test positive?',
          options: [
            'About 11 people total (1 true positive + ~10 false positives out of 999 healthy people), so P(Disease | +) ≈ 1 / 11 ≈ 9%',
            'Only 1 person tests positive, so P(Disease | +) = 99%',
            '990 people test positive',
            'Zero people test positive',
          ],
          correctIndex: 0,
          resolution:
            'Boom! Seeing it in natural frequencies (1,000 people -> 1 sick + 999 healthy -> 1 true positive vs ~10 false positives) makes Bayes’ theorem feel 100% self-evident!',
        },
        teachingStep: {
          coreExplanation:
            'A positive test (+) can arise through two mutually exclusive paths: (Path 1: True Positive) You have D AND test positive: P(D)·P(+|D). (Path 2: False Positive) You are healthy ¬D AND test positive: P(¬D)·P(+|¬D). Bayes’ theorem is simply the share of Path 1 out of both paths combined: P(D|+) = TP / (TP + FP). Even faster for exams is the Odds Form: Prior Odds = P(D)/P(¬D), Likelihood Ratio LR+ = Sensitivity / False-Positive Rate = P(+|D)/P(+|¬D), and Posterior Odds = Prior Odds × LR+.',
          visualMentalModel:
            'Population (1,000) ──┬── Sick (1)     ──[99% Sens]──> ~1 True Positive (TP)\n                     └── Healthy (999) ──[1% FP   ]──> ~10 False Positives (FP)\nPosterior P(D | +) = TP / (TP + FP) = 1 / (1 + 10) = 1/11 ≈ 9.0%',
          keyFormulaOrRule:
            'Posterior Odds = Prior Odds × [ P(+ | D) / P(+ | ¬D) ]   where   P(D | +) = Odds / (1 + Odds)',
          checkQuestion: {
            question:
              'If Prior Odds of fraud on a credit card swipe are 1 : 100, and an AI detector has True Positive Rate 90% and False Positive Rate 1% (Likelihood Ratio = 90 / 1 = 90), what are the Posterior Odds and probability of fraud given an alert?',
            options: [
              {
                text: 'Posterior Odds = (1/100) × 90 = 9 : 10, so P(Fraud | Alert) = 9 / (9 + 10) = 9/19 ≈ 47.4%.',
                diagnosticFeedback:
                  'Look how fast the Odds Form is! One multiplication (1/100 × 90 = 9/10) and Odds/(1+Odds) = 9/19.',
              },
              {
                text: 'P(Fraud | Alert) = 90% because the True Positive Rate is 90%.',
                misconceptionTag: 'prosecutors-fallacy',
                diagnosticFeedback: 'Confusing P(Alert | Fraud) = 90% with P(Fraud | Alert) is the classic Base-Rate / Prosecutor’s Fallacy!',
              },
              {
                text: 'P(Fraud | Alert) = 0.9% (multiplying 1% × 90% without dividing by total positives).',
                misconceptionTag: 'joint-vs-conditional',
                diagnosticFeedback: '0.9% is the joint probability P(Fraud ∩ Alert), not the conditional probability P(Fraud | Alert).',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'What is the "Base-Rate Fallacy" (or Prosecutor’s Fallacy) in Bayesian probability?',
            options: [
              {
                text: 'Equating the likelihood P(Evidence | Hypothesis) with the posterior P(Hypothesis | Evidence) while ignoring the prior base rate P(Hypothesis).',
                misconception: 'None',
                explanation: 'When P(Hypothesis) is very small, false positives P(E | ¬H)P(¬H) can swamp true positives.',
              },
              {
                text: 'Assuming that two independent events satisfy P(A ∩ B) = P(A)P(B).',
                misconception: 'Confusing independence definition with base-rate neglect.',
                explanation: 'P(A ∩ B) = P(A)P(B) is the true definition of statistical independence.',
              },
              {
                text: 'Using natural frequencies instead of decimals to compute Bayes’ rule.',
                misconception: 'Natural frequencies are actually a valid, error-reducing representation.',
                explanation: 'Natural frequency trees are mathematically equivalent to Bayes’ theorem.',
              },
              {
                text: 'Updating a prior into a posterior before a second independent test is run.',
                misconception: 'Sequential Bayesian updating is completely valid.',
                explanation: 'Today’s posterior becomes tomorrow’s prior for a new independent test.',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'After testing positive once on the rare-disease screen (raising P(D) from 0.1% to ~9%), the patient takes a SECOND, statistically independent test with the same 99% sensitivity and 1% false-positive rate, and tests positive again.',
            confusableWith: 'Single test from 0.1% prior vs. Sequential Bayesian update starting from the 9% posterior as the new prior',
            question:
              'Why does the second positive test jump the probability of disease from ~9% all the way to ~91%?',
            options: [
              {
                text: 'Sequential updating uses the first test’s posterior odds (~1 : 10) as the new prior odds for the second test; multiplying by LR+ = 99 again gives Posterior Odds ≈ 99 : 10 ≈ 90.8%!',
                whyRightOrWrong:
                  'Exact Bayesian mechanics! Two independent 99:1 likelihood ratios multiply: (1/999) × 99 × 99 ≈ 9.8 : 1 odds.',
              },
              {
                text: 'Because two tests always add their probabilities: 9% + 9% = 18%.',
                whyRightOrWrong: 'Likelihood ratios multiply on the odds scale; probabilities do not add linearly.',
              },
              {
                text: 'The probability stays ~9% because the population base rate is still 1 in 1,000.',
                whyRightOrWrong: 'Conditioned on the first positive test, the patient is no longer a random draw from the unscreened population!',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'Write Bayes’ Theorem in both standard probability form and Posterior Odds form, defining the Likelihood Ratio (LR+).',
            acceptedKeywords: ['prior', 'likelihood', 'posterior', 'false positive', 'odds', 'tp'],
            canonicalAnswer:
              'P(H|E) = P(E|H)P(H) / [P(E|H)P(H) + P(E|¬H)P(¬H)]; Posterior Odds = Prior Odds × LR+, where LR+ = P(+|H) / P(+|¬H) = Sensitivity / (1 - Specificity).',
            hints: [
              'R0: Express P(H|E) as True Positives divided by (True Positives + False Positives).',
              'R1: Now divide P(H|E) by P(¬H|E) so the denominators cancel!',
              'R2: Notice how P(H|E)/P(¬H|E) = [P(H)/P(¬H)] × [P(E|H)/P(E|¬H)].',
              'R3: Proposition: Posterior Odds = Prior Odds × (Sensitivity / False-Positive Rate).',
              'R4: State both forms: (1) P(H|E) fraction with law of total probability in denominator; (2) Odds form with LR+.',
              'R5: Complete answer: P(H|E) = P(E|H)P(H) / [P(E|H)P(H) + P(E|¬H)P(¬H)]. In odds form, Posterior Odds = Prior Odds × [P(E|H)/P(E|¬H)].',
            ],
          },
          application: {
            examProblem:
              'A factory has two machines: Machine A makes 20% of chips with a 5% defect rate; Machine B makes 80% of chips with a 1% defect rate. You pick a random chip and find it is defective. (1) Compute P(Defective) using the Law of Total Probability. (2) Compute P(Machine A | Defective). (3) Verify using Prior Odds × Likelihood Ratio.',
            feynmanPrompt:
              'Solve this classic exam problem two ways—using a 100-chip frequency table AND using the Odds Ratio shortcut.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Compute total defect rate: P(D) = (0.20)(0.05) + (0.80)(0.01) = 0.010 + 0.008 = 0.018 (1.8%)',
                keywords: ['0.018', '1.8%', '0.01', '0.008', 'total'],
              },
              {
                id: 'm2',
                label: 'Apply Bayes rule: P(A | D) = 0.010 / (0.010 + 0.008) = 10 / 18 = 5/9 ≈ 55.6%',
                keywords: ['5/9', '10/18', '55.6%', '55.5%', '0.556'],
              },
              {
                id: 'm3',
                label: 'Verify via Odds: Prior Odds (A:B) = 20:80 = 1:4; Likelihood Ratio = 5% / 1% = 5; Posterior Odds = (1/4) × 5 = 5:4 => P(A|D) = 5/(5+4) = 5/9',
                keywords: ['1:4', '1/4', '5:4', '5/4', 'odds', 'likelihood ratio'],
              },
            ],
            modelSolution:
              '1) By the Law of Total Probability: P(D) = P(A)P(D|A) + P(B)P(D|B) = (0.20)(0.05) + (0.80)(0.01) = 0.010 + 0.008 = 0.018 (or out of 1,000 chips: 10 bad from A + 8 bad from B = 18 bad chips). 2) P(A | D) = 0.010 / 0.018 = 10 / 18 = 5/9 ≈ 55.6%. 3) Odds check: Prior Odds of A vs B = 0.20 / 0.80 = 1/4. Likelihood Ratio P(D|A)/P(D|B) = 0.05 / 0.01 = 5. Posterior Odds = (1/4) × 5 = 5/4, which converts to probability 5 / (5 + 4) = 5/9.',
            commonTraps: [
              'Dividing 0.05 by (0.05 + 0.01) = 5/6 while ignoring the 20% vs 80% production shares',
              'Forgetting to convert Posterior Odds 5:4 into probability 5/(5+4) = 5/9',
            ],
            hints: [
              'R0: Imagine 1,000 total chips: 200 come from Machine A (5% bad) and 800 come from Machine B (1% bad).',
              'R1: How many bad chips come from A (5% of 200) and how many from B (1% of 800)?',
              'R2: 10 bad chips from A and 8 bad chips from B = 18 total bad chips! So P(A|D) = 10/18 = 5/9.',
              'R3: Now confirm with Prior Odds (1:4) × Likelihood Ratio (5:1) = Posterior Odds (5:4).',
              'R4: Write: (1) P(D) = 0.018; (2) P(A|D) = 10/18 = 5/9 ≈ 55.6%; (3) Odds check (1/4)×5 = 5:4.',
              'R5: Complete solution: P(D) = 0.2(0.05) + 0.8(0.01) = 0.018. P(A|D) = 0.010/0.018 = 5/9 (55.6%). Odds check: Prior 1:4 × LR 5 = 5:4 odds = 5/9.',
            ],
          },
        },
      },
      {
        id: 'risk-aversion-nash',
        unitId: 'u2-utility-games',
        title: 'Concave Expected Utility (Risk Aversion) & Nash Equilibrium',
        statement:
          'A decision-maker with strictly concave utility u\'\'(w) < 0 prefers a sure Expected Value E[W] over a risky gamble (Certainty Equivalent CE < E[W], Positive Risk Premium RP = E[W] - CE); in a simultaneous game, a Nash Equilibrium is a strategy profile where every player’s strategy is a best response to the others.',
        isUnconditionalTruth: false,
        prerequisites: ['bayes-base-rate'],
        examWeight: 5,
        motivatedHook:
          'Why is a rational person willing to pay $1,200/year for insurance whose expected payout is only $900, and why do two rational firms in a Prisoner’s Dilemma both choose an outcome worse for both of them?',
        predictionPrompt: {
          question:
            'If your utility of wealth is u(w) = √w (so $0 gives 0 utils, $100 gives 10 utils, and $400 gives 20 utils), how do you value a 50/50 coin flip between $0 and $400 (Expected Wealth = $200)?',
          options: [
            'Expected Utility is 0.5(0) + 0.5(20) = 10 utils, which equals the utility of a sure $100 (√100 = 10) — so you would accept $100 for sure rather than risk the $200 expected flip!',
            'You value the flip at exactly $200 because E[W] = $200',
            'You would pay $250 to play the flip',
            'Expected Utility is √400 = 20 utils',
          ],
          correctIndex: 0,
          resolution:
            'Spot on! Because going from $0 → $100 adds +10 utils while going from $100 → $400 (three times as many dollars!) only adds another +10 utils, the downside pain outweighs the upside gain. Here CE = $100 and Risk Premium = $200 - $100 = $100!',
        },
        teachingStep: {
          coreExplanation:
            '1) Expected Utility & Risk Aversion: With diminishing marginal utility (u\'(w) > 0, u\'\'(w) < 0), Jensen’s Inequality guarantees E[u(W)] < u(E[W]). The Certainty Equivalent (CE) is the sure wealth satisfying u(CE) = E[u(W)]. The Risk Premium RP = E[W] - CE > 0 is the maximum amount below E[W] the agent gives up to eliminate risk. 2) Strategic Games & Nash Equilibrium: A strategy s_i is Strictly Dominant if it yields a strictly higher payoff than any alternative regardless of what the opponent plays. A profile (s_1*, s_2*) is a Nash Equilibrium if s_1* is a best response to s_2* AND s_2* is a best response to s_1*. In the Prisoner’s Dilemma, mutual defection is the unique Dominant-Strategy Nash Equilibrium even though mutual cooperation Pareto-dominates it!',
          visualMentalModel:
            'Utility u(w) ^          .--- u(E[W]) (Sure Expected Value)\n             |       . /|\n             |     .  / | <-- Risk Premium gap\n             |   .---*  | <-- E[u(W)] = u(CE)\n             +───|───|──+────> Wealth w\n                CE  E[W]',
          keyFormulaOrRule:
            'u(CE) = E[u(W)]   |   Risk Premium RP = E[W] - CE   |   Nash: u_i(s_i*, s_{-i}*) ≥ u_i(s_i, s_{-i}*) ∀i',
          checkQuestion: {
            question:
              'Which statement correctly distinguishes a Strictly Dominant Strategy Equilibrium from a general Nash Equilibrium?',
            options: [
              {
                text: 'Every Strictly Dominant Strategy Equilibrium is a Nash Equilibrium, but many Nash Equilibria (like Coordination / Battle of the Sexes games) do NOT involve dominant strategies because the best move depends on what the other player chooses.',
                diagnosticFeedback:
                  'Exact set-inclusion relationship: Dominant Strategy Equilibrium ⊂ Nash Equilibrium!',
              },
              {
                text: 'A Nash Equilibrium is always Pareto-optimal (maximizes total group welfare).',
                misconceptionTag: 'pareto-nash-confusion',
                diagnosticFeedback: 'The Prisoner’s Dilemma is the famous counterexample: its unique Nash Equilibrium is Pareto-inefficient!',
              },
              {
                text: 'A player can profitably switch away from their strategy in a Nash Equilibrium while others hold theirs fixed.',
                misconceptionTag: 'deviation-confusion',
                diagnosticFeedback: 'By definition, no unilateral deviation can strictly improve a player’s payoff in a Nash Equilibrium.',
              },
            ],
            correctIndex: 0,
          },
        },
        quizletStages: {
          recognition: {
            question:
              'For a strictly risk-averse consumer with concave utility u\'\'(w) < 0 facing a non-degenerate lottery W, which inequality always holds?',
            options: [
              {
                text: 'E[u(W)] < u(E[W]), so Certainty Equivalent CE < E[W] and Risk Premium RP = E[W] - CE > 0.',
                misconception: 'None',
                explanation: 'By Jensen’s Inequality on a strictly concave function, the chord lies below the curve.',
              },
              {
                text: 'E[u(W)] > u(E[W]) and CE > E[W].',
                misconception: 'Confusing risk aversion (concave) with risk loving (convex u\'\'(w) > 0).',
                explanation: 'CE > E[W] holds only for risk-seeking agents.',
              },
              {
                text: 'E[u(W)] = u(E[W]) and RP = 0.',
                misconception: 'Confusing risk aversion with risk neutrality (linear u(w)).',
                explanation: 'Only linear utility u(w) = aw + b gives zero risk premium.',
              },
              {
                text: 'u\'(w) < 0 (more wealth decreases total happiness).',
                misconception: 'Confusing first derivative u\'(w) > 0 with second derivative u\'\'(w) < 0.',
                explanation: 'Marginal utility u\'(w) is positive (more wealth is better), but diminishing (u\'\'(w) < 0).',
              },
            ],
            correctIndex: 0,
          },
          discrimination: {
            scenario:
              'In a 2×2 game between two airlines choosing {High Price, Low Price}, (Low, Low) gives (5, 5), (High, High) gives (10, 10), (Low, High) gives (14, 2), and (High, Low) gives (2, 14).',
            confusableWith: 'Nash Equilibrium vs. Pareto Optimal Outcome in a Prisoner’s Dilemma',
            question:
              'What is the Nash Equilibrium vs. the Pareto-efficient outcomes in this game?',
            options: [
              {
                text: '(Low, Low) yielding (5, 5) is the unique Nash Equilibrium (since Low strictly dominates High: 14 > 10 and 5 > 2), whereas (High, High), (Low, High), and (High, Low) are Pareto-efficient.',
                whyRightOrWrong:
                  'Crystal clear! If Opponent plays High, Low gets 14 > 10; if Opponent plays Low, Low gets 5 > 2. Both play Low and get (5,5) even though (10,10) makes both better off.',
              },
              {
                text: '(High, High) yielding (10, 10) is the unique Nash Equilibrium because 10 + 10 = 20 is the highest sum.',
                whyRightOrWrong: 'At (High, High), either airline can unilaterally deviate to Low and jump from 10 to 14!',
              },
              {
                text: 'There is no pure-strategy Nash Equilibrium in this game.',
                whyRightOrWrong: '(Low, Low) is a pure-strategy Dominant-Strategy Nash Equilibrium.',
              },
            ],
            correctIndex: 0,
          },
          cuedRecall: {
            prompt:
              'Define Certainty Equivalent (CE), Risk Premium (RP), and Nash Equilibrium, and state why (Cooperate, Cooperate) fails to be a Nash Equilibrium in the one-shot Prisoner’s Dilemma.',
            acceptedKeywords: ['u(ce)', 'e[u(w)]', 'e[w] - ce', 'unilateral', 'deviat', 'best response', 'concave'],
            canonicalAnswer:
              'CE satisfies u(CE) = E[u(W)]; RP = E[W] - CE (>0 when u\'\' < 0); a Nash Equilibrium is a mutual best response where no player gains by unilateral deviation; in Prisoner’s Dilemma, each player has a strict incentive to defect from (C, C).',
            hints: [
              'R0: Write the equation connecting u(CE) to the expected utility of the gamble E[u(W)].',
              'R1: Once you solve u(CE) = E[u(W)] for CE, how do you compute the Risk Premium RP?',
              'R2: RP = E[W] - CE! Now define Nash Equilibrium in terms of unilateral deviation.',
              'R3: Proposition: u(CE) = E[u(W)], RP = E[W] - CE; Nash = mutual best response with no profitable unilateral deviation.',
              'R4: State: (1) CE formula, (2) RP = E[W] - CE, (3) Nash definition & why Defect beats Cooperate unilaterally.',
              'R5: Complete answer: CE is the sure wealth where u(CE) = E[u(W)], and RP = E[W] - CE. A Nash Equilibrium means every player plays a best response (no profitable unilateral deviation); (C,C) fails because defecting unilaterally yields a higher individual payoff.',
            ],
          },
          application: {
            examProblem:
              'An entrepreneur with utility u(w) = √w has initial wealth $100 and owns a startup ticket that pays $84 (total wealth $184? No—let’s use clean squares: pays either $300 so w_good = $400 with prob 0.5, or loses $64 so w_bad = $36 with prob 0.5). (1) Compute Expected Wealth E[W]. (2) Compute Expected Utility E[u(W)] and Certainty Equivalent CE. (3) Compute the Risk Premium RP and the maximum insurance premium she would pay to guarantee E[W].',
            feynmanPrompt:
              'Walk a classmate through the 3-step recipe for every Expected Utility / Certainty Equivalent exam problem: E[W] -> E[u(W)] -> invert u(CE) -> subtract RP.',
            requiredMoves: [
              {
                id: 'm1',
                label: 'Compute Expected Wealth: E[W] = 0.5(400) + 0.5(36) = 200 + 18 = $218',
                keywords: ['218', '$218', '200 + 18'],
              },
              {
                id: 'm2',
                label: 'Compute Expected Utility and invert u(CE) = √CE: E[u(W)] = 0.5(√400) + 0.5(√36) = 0.5(20) + 0.5(6) = 13 utils => CE = 13^2 = $169',
                keywords: ['13', '169', '$169', '20', '6'],
              },
              {
                id: 'm3',
                label: 'Compute Risk Premium: RP = E[W] - CE = $218 - $169 = $49 (she is willing to sacrifice up to $49 of expected value to remove the risk)',
                keywords: ['49', '$49', '218 - 169'],
              },
            ],
            modelSolution:
              '1) Expected Wealth: E[W] = 0.5($400) + 0.5($36) = $200 + $18 = $218. 2) Expected Utility: E[u(W)] = 0.5·√400 + 0.5·√36 = 0.5(20) + 0.5(6) = 10 + 3 = 13 utils. Setting u(CE) = √CE = 13 gives Certainty Equivalent CE = 13² = $169. 3) Risk Premium: RP = E[W] - CE = $218 - $169 = $49. Because she is indifferent between the risky gamble and $169 for sure, she would pay up to $218 - $169 = $49 above the actuarially fair cost to lock in certainty.',
            commonTraps: [
              'Taking √E[W] = √218 instead of averaging the square roots 0.5√400 + 0.5√36 = 13',
              'Forgetting to square E[u(W)] = 13 back into dollars (CE = 13² = $169) before subtracting from E[W] = $218',
            ],
            hints: [
              'R0: Follow the 3 steps: (1) Average the dollars for E[W]; (2) Average the square roots for E[u(W)]; (3) Square E[u(W)] to get CE.',
              'R1: What is 0.5(400) + 0.5(36)? And what is 0.5(√400) + 0.5(√36)?',
              'R2: E[W] = $218, and E[u(W)] = 0.5(20) + 0.5(6) = 13 utils! Now solve √CE = 13.',
              'R3: CE = 13² = $169! Now subtract RP = E[W] - CE = 218 - 169.',
              'R4: Write: (1) E[W] = $218, (2) E[u(W)] = 13 => CE = $169, (3) RP = $218 - $169 = $49.',
              'R5: Complete answer: E[W] = $218; E[u(W)] = 0.5(20) + 0.5(6) = 13 utils, so CE = 13² = $169; Risk Premium RP = $218 - $169 = $49.',
            ],
          },
        },
      },
    ],
  },
];
