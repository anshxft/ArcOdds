import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': import.meta.dirname + '/src' } },
  // networks.json lives at the repo root (shared with the contract scripts and share cards)
  server: { fs: { allow: ['..'] } },
})
