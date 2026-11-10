#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const assetsDir = path.join(distDir, 'assets');

const files = fs.readdirSync(assetsDir);
const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('Missing built CSS or JS in dist/assets. Run npm run build first.');
  process.exit(1);
}

const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
const rawJsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
const safeJsContent = rawJsContent.replace(/<\/script>/gi, '<\\/script>');

const standaloneHtml = `<!doctype html>
<html lang="en" data-theme="dark" data-type="software">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="page-type" content="software" />
    <title>LearnHarness Pro — Cognitive Exam Mastery & Socratic Knowledge Graph</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>${cssContent}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      // Client-Side OpenAI Account Auth & Local Mac Bridge Router for GitHub Pages / Standalone Mode
      (function() {
        const originalFetch = window.fetch.bind(window);
        let standaloneState = {
          activeProvider: 'chatgpt-oauth',
          codexCliAvailable: false,
          claudeCliAvailable: false,
          chatgptOAuthConnected: false,
          openaiKeyConfigured: false,
          anthropicKeyConfigured: false,
          tokenStats: {
            localZeroTokenActions: 0,
            aiAssistedActions: 0,
            estimatedTokensSaved: 0,
            estimatedApiCostUsd: 0
          }
        };

        function getStoredOpenAIToken() {
          try {
            const raw = (window.localStorage.getItem('lh_openai_account_token') || '').trim();
            if (raw.startsWith('{')) {
              const p = JSON.parse(raw);
              return p.access_token || p.token || p.OPENAI_API_KEY || '';
            }
            return raw;
          } catch (e) {
            return '';
          }
        }

        function getStoredKey(k) {
          try {
            return (window.localStorage.getItem(k) || '').trim();
          } catch (e) {
            return '';
          }
        }

        window.fetch = async function(input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';

          // 1. Intercept /api/subscriptions on static GitHub Pages
          if (url.includes('/api/subscriptions')) {
            const openAITok = getStoredOpenAIToken();
            const xaiKey = getStoredKey('lh_xai_key') || getStoredKey('lh_xai_account_token');
            const anthropicKey = getStoredKey('lh_anthropic_key') || getStoredKey('lh_anthropic_account_token');
            const copilotTok = getStoredKey('lh_copilot_token');

            if (init && init.method === 'POST' && init.body) {
              try {
                const req = JSON.parse(init.body);
                if (req.op === 'disconnect') {
                  if (req.providerId === 'chatgpt') window.localStorage.removeItem('lh_openai_account_token');
                  if (req.providerId === 'xai') { window.localStorage.removeItem('lh_xai_key'); window.localStorage.removeItem('lh_xai_account_token'); }
                  if (req.providerId === 'anthropic') { window.localStorage.removeItem('lh_anthropic_key'); window.localStorage.removeItem('lh_anthropic_account_token'); }
                }
              } catch (e) {}
            }

            const nativeList = [
              {
                providerId: 'xai',
                available: true,
                connected: xaiKey.length > 5,
                pending: false,
                allowBackgroundUse: true,
                connectionId: xaiKey.length > 5 ? 'xai-connected' : null
              },
              {
                providerId: 'anthropic',
                available: true,
                connected: anthropicKey.length > 5,
                pending: false,
                allowBackgroundUse: true,
                connectionId: anthropicKey.length > 5 ? 'anthropic-connected' : null
              },
              {
                providerId: 'github-copilot',
                available: true,
                connected: copilotTok.length > 5,
                pending: false,
                allowBackgroundUse: true,
                connectionId: copilotTok.length > 5 ? 'copilot-connected' : null
              }
            ];

            const chatgptObj = {
              available: true,
              pending: false,
              allowBackgroundUse: true,
              activeId: openAITok.length > 5 ? 'chatgpt-account' : null,
              accounts: openAITok.length > 5 ? [{ id: 'chatgpt-account', label: 'ChatGPT / Codex User', plan: 'Pro/Team' }] : [],
              error: null
            };

            return new Response(JSON.stringify({
              chatgpt: chatgptObj,
              native: nativeList,
              value: nativeList
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          if (url.endsWith('/api/ai/status')) {
            const tok = getStoredOpenAIToken();
            const xKey = getStoredKey('lh_xai_key');
            standaloneState.openaiKeyConfigured = tok.length > 12;
            standaloneState.chatgptOAuthConnected = tok.length > 12;
            standaloneState.activeProvider = xKey ? 'xai' : (tok ? 'chatgpt-oauth' : 'local-engine');
            return new Response(JSON.stringify(standaloneState), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          if (url.includes('/api/ai/configure') || url.includes('/api/ai/config')) {
            return new Response(JSON.stringify({ ok: true, status: standaloneState }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          if (url.includes('/api/ai/chat') && init && init.body) {
            const tok = getStoredOpenAIToken();
            if (tok && tok.length > 12) {
              try {
                return await originalFetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
                  body: init.body,
                });
              } catch (e) {}
            }
            return new Response(JSON.stringify({ ok: false, error: 'No AI key' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
          }

          if (url.includes('/api/ai/tutor') && init && init.body) {
            try {
              const body = JSON.parse(init.body);
              const isStrict = body.mode === 'strict_examiner';
              const title = body.nodeTitle || 'this proposition';
              const truth = body.unconditionalTruth || '';
              const learnerText = body.learnerResponse || body.questionPrompt || '';
              const openAIToken = getStoredOpenAIToken();
              const xaiKey = getStoredKey('lh_xai_key') || getStoredKey('lh_xai_account_token');
              const anthropicKey = getStoredKey('lh_anthropic_key') || getStoredKey('lh_anthropic_account_token');

              // 1. Direct Grok (xAI) if configured
              if (xaiKey && xaiKey.length > 8) {
                try {
                  const xRes = await originalFetch('https://api.x.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ' + xaiKey
                    },
                    body: JSON.stringify({
                      model: 'grok-2-latest',
                      messages: [
                        { role: 'system', content: isStrict
                            ? 'You are the LearnHarness Strict Examiner for "' + title + '" (truth: ' + truth + '). Challenge vague answers.'
                            : 'You are the LearnHarness Socratic Tutor for "' + title + '" (truth: ' + truth + '). Give a minimal R2 hint.' },
                        { role: 'user', content: learnerText || ('Tutor me on ' + title) }
                      ],
                      max_tokens: 220,
                      temperature: 0.3
                    })
                  });
                  if (xRes.ok) {
                    const xData = await xRes.json();
                    const reply = xData.choices?.[0]?.message?.content;
                    if (reply) {
                      standaloneState.tokenStats.aiAssistedActions += 1;
                      return new Response(JSON.stringify({
                        reply: reply,
                        message: reply,
                        providerUsed: 'Grok (grok-2-latest · Live xAI)',
                        cachedOrZeroToken: false
                      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    }
                  }
                } catch (e) {}
              }

              // 2. Direct OpenAI Account / Key if configured
              if (openAIToken && openAIToken.length > 12) {
                const sysPrompt = isStrict
                  ? 'You are the LearnHarness Strict Examiner. Interrogate the student’s explanation of "' + title + '" against the ground truth ("' + truth + '"). Expose any vague hand-waving in 2-3 sharp sentences.'
                  : 'You are the LearnHarness Socratic Coach. Give a minimal R2 structural hint for "' + title + '" (ground truth: "' + truth + '") without spoiling the full answer in 2-3 concise sentences.';

                const oaRes = await originalFetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + openAIToken
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                      { role: 'system', content: sysPrompt },
                      { role: 'user', content: learnerText || ('Help me with ' + title) }
                    ],
                    max_tokens: 220,
                    temperature: 0.3
                  })
                });
                if (oaRes.ok) {
                  const oaData = await oaRes.json();
                  const replyText = oaData.choices && oaData.choices[0] && oaData.choices[0].message && oaData.choices[0].message.content;
                  if (replyText) {
                    standaloneState.tokenStats.aiAssistedActions += 1;
                    return new Response(JSON.stringify({
                      reply: replyText,
                      message: replyText,
                      providerUsed: 'OpenAI Account (gpt-4o-mini · Live)',
                      cachedOrZeroToken: false
                    }), {
                      status: 200,
                      headers: { 'Content-Type': 'application/json' }
                    });
                  }
                }
              }

              // 3. Try local Mac bridge (http://127.0.0.1:5173/api/ai/tutor) if running
              try {
                const localRes = await originalFetch('http://127.0.0.1:5173/api/ai/tutor', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: init.body
                });
                if (localRes.ok) {
                  return localRes;
                }
              } catch (e) {}

              // 4. Fallback to 0-Token Pre-Compiled Socratic Doctrine Engine
              standaloneState.tokenStats.localZeroTokenActions += 1;
              standaloneState.tokenStats.estimatedTokensSaved += 950;
              const fallbackReply = isStrict
                ? '[Strict Examiner Stress-Test]: State the exact causal chain for "' + title + '" without relying on buzzwords. Specifically: what breaks immediately if the upstream premise is violated? Reference invariant: ' + truth
                : '[Socratic Coach (Minimal Hint)]: Pause and trace the causal arrow for "' + title + '". Which boundary condition or invariant governs this transition? Reference anchor: ' + truth;

              return new Response(JSON.stringify({
                reply: fallbackReply,
                message: fallbackReply,
                providerUsed: '0-Token Pre-Compiled Socratic Engine',
                cachedOrZeroToken: true
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            } catch (e) {}
          }

          return originalFetch(input, init);
        };
      })();
    </script>
    <script type="module">${safeJsContent}</script>
  </body>
</html>`;

const standaloneOutPath = path.join(rootDir, 'LearnHarness-Pro-Standalone.html');
fs.writeFileSync(standaloneOutPath, standaloneHtml, 'utf8');
console.log('Generated standalone HTML:', standaloneOutPath, '(' + Math.round(standaloneHtml.length / 1024) + ' KB)');
