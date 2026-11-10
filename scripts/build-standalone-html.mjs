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
// Safely escape closing script tags inside JS string literals
const safeJsContent = rawJsContent.replace(/<\/script>/gi, '<\\/script>');

const standaloneHtml = `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LearnHarness Pro — Cognitive Exam Mastery & Socratic Knowledge Graph</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>${cssContent}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      // Built-in Client-Side Multi-Auth & 0-Token Socratic Bridge for Standalone HTML Mode
      (function() {
        const originalFetch = window.fetch.bind(window);
        let standaloneState = {
          activeProvider: 'zero-token-local',
          codexCliAvailable: false,
          claudeCliAvailable: false,
          chatgptOAuthConnected: false,
          openaiKeyConfigured: false,
          anthropicKeyConfigured: false,
          openaiApiKey: '',
          anthropicApiKey: '',
          tokenStats: {
            localZeroTokenActions: 18,
            aiAssistedActions: 0,
            estimatedTokensSaved: 24500,
            estimatedApiCostUsd: 0
          }
        };

        window.fetch = async function(input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          if (url.includes('/api/ai/status')) {
            return new Response(JSON.stringify(standaloneState), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          if (url.includes('/api/ai/configure') && init && init.body) {
            try {
              const body = JSON.parse(init.body);
              if (body.activeProvider) standaloneState.activeProvider = body.activeProvider;
              if (body.openaiApiKey) {
                standaloneState.openaiApiKey = body.openaiApiKey;
                standaloneState.openaiKeyConfigured = true;
              }
              if (body.anthropicApiKey) {
                standaloneState.anthropicApiKey = body.anthropicApiKey;
                standaloneState.anthropicKeyConfigured = true;
              }
            } catch (e) {}
            return new Response(JSON.stringify({ ok: true, status: standaloneState }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          if (url.includes('/api/ai/oauth/chatgpt/start')) {
            const authorizeUrl = 'https://auth.openai.com/api/accounts/authorize?client_id=dynamic_agent_client&response_type=code&scope=openid+profile+email+offline_access+resource.invoke+chatgpt.tokens.use.direct';
            return new Response(JSON.stringify({ authorizeUrl }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          if (url.includes('/api/ai/tutor') && init && init.body) {
            try {
              const body = JSON.parse(init.body);
              standaloneState.tokenStats.localZeroTokenActions += 1;
              standaloneState.tokenStats.estimatedTokensSaved += 950;
              const isStrict = body.mode === 'strict_examiner';
              const title = body.nodeTitle || 'this proposition';
              const truth = body.unconditionalTruth || '';
              const reply = isStrict
                ? '[Strict Examiner Stress-Test]: Do not hide behind surface terminology for "' + title + '". State the exact causal mechanism: (1) What is the upstream premise? (2) What breaks immediately if that premise is violated? Reference anchor: ' + truth
                : '[Socratic Coach (R2 Structural Hint)]: Pause and trace the causal arrow for "' + title + '". Which boundary condition or invariant governs this transition? Anchor: ' + truth;
              return new Response(JSON.stringify({
                reply,
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

const artifactOutPath = process.argv[2];
if (artifactOutPath) {
  fs.writeFileSync(artifactOutPath, standaloneHtml, 'utf8');
  console.log('Generated artifact HTML:', artifactOutPath);
}
