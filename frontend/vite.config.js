import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Proxy configuration for FastAPI Backend
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // Assuming your FastAPI runs on port 8000
        changeOrigin: true,
        secure: false,
      }
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'PashuSetu Livestock Health',
        short_name: 'PashuSetu',
        description: 'AI-Powered Dairy & Cattle Triage',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})