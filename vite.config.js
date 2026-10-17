import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    strictPort: true,
    allowedHosts: ['frontend.mywebapp.ngrok.dev', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
  },
});
