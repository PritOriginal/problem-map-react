import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: 'problem-map.pritoriginal.ru'
  },
  plugins: [react()],
})
