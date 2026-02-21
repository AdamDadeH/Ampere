import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@proton/shared'] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@proton/shared'] })]
  },
  renderer: {
    plugins: [react(), tailwindcss()]
  }
})
