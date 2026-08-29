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
    build: {
      // Pinned rather than left to Vite's default so a toolchain upgrade cannot
      // silently move the syntax floor under the browsers we support.
      target: 'es2020',
      // Below Vite's 500 kB default on purpose: the app is code-split now, and a
      // chunk creeping back over 400 kB is a regression we want CI to print.
      chunkSizeWarningLimit: 400,
      rollupOptions: {
        output: {
          // Only the framework runtime, and only for cache lifetime -- not size.
          // React/router/mobx change a few times a year, app code changes daily,
          // so keeping them apart stops every panel edit from invalidating the
          // whole bundle for every returning user.
          //
          // Deliberately NOT split: ymap3-components and @yandex/ymaps3-clusterer.
          // They are coupled to the map provider's initialisation order, and
          // forcing them into a chunk of their own risks init cycles. Rollup
          // places them on its own.
          manualChunks: {
            vendor: [
              'react',
              'react-dom',
              'react-router-dom',
              'mobx',
              'mobx-react-lite',
              'mobx-persist-store',
            ],
          },
        },
      },
    },
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
