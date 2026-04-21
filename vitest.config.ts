import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 15000,
    // Mock `server-only` so Server Action modules can be imported in Vitest
    // (Vitest runs in Node, not a Next.js server context — the runtime guard is not needed in tests)
    server: {
      deps: {
        inline: ['server-only'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub `server-only` — no-op in test environment
      'server-only': path.resolve(__dirname, './tests/__mocks__/server-only.ts'),
      // Stub Next.js server-only APIs (cookies, headers, redirect) for Vitest
      'next/headers': path.resolve(__dirname, './tests/__mocks__/next-headers.ts'),
      'next/navigation': path.resolve(__dirname, './tests/__mocks__/next-navigation.ts'),
    },
  },
})
