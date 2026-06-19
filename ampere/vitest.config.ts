import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Logic tests (.test.ts) run in the default node env; component/perf
    // tests (.test.tsx) opt into jsdom via a `// @vitest-environment jsdom`
    // docblock so they don't slow down or pollute the node-env suite.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
