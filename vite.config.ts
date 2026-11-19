import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.ATELIER_BASE_PATH || '/',
  plugins: [
    {
      name: 'atelier-production-csp',
      apply: 'build',
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            injectTo: 'head-prepend',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content:
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'",
            },
          },
        ]
      },
    },
  ],
})
