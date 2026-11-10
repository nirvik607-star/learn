import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apexLearnAiBridgePlugin } from './server/aiBridgePlugin.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apexLearnAiBridgePlugin()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
});
