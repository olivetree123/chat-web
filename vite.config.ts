import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://10.240.1.171:16000",
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, ""), // 如果后端接口没有 /api 前缀，则需要这行
      },
    },
  },
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100000000
  }
})
