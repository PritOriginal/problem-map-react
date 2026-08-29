/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from 'vite-plugin-svgr';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const plugins: PluginOption[] = [react(), svgr()]
  // Bundle treemap on demand only (`ANALYZE=1 npm run build`): a normal build
  // must not pay for the gzip/brotli passes the report needs.
  if (process.env.ANALYZE) {
    plugins.push(visualizer({
      filename: "dist/stats.html",
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
    }) as PluginOption)
  }
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
    plugins,
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler'
        }
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      globals: false,
      // Agent worktrees under .claude/ hold full copies of src/; without this
      // every test file would be collected twice per live worktree.
      exclude: ["**/node_modules/**", "**/dist/**", ".claude/worktrees/**"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        include: ["src/**"],
        exclude: ["src/**/*.test.*", "src/test/**", "src/i18n/ru.ts", "src/i18n/en.ts"],
      },
    },
  }
})
