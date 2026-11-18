import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.ATELIER_BASE_PATH || '/',
})
