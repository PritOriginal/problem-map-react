import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      host: env.APP_HOST,
      port: Number(env.APP_PORT),
      proxy: {
        '/api': {
          target: `http://${env.API_HOST}:${env.API_PORT}`,
          rewrite: (path) => path.replace(/^\/api/, '/'),
        }
      }
    },
    plugins: [react()],
  }
})
