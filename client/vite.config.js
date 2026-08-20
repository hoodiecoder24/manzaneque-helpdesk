import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only proxy so the client can call same-origin /api paths without
// juggling CORS locally; CORS_ORIGIN in .env still governs the real
// cross-origin case (built client served separately, or a different port).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
});
