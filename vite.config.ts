import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Self-host the Pyodide runtime for the live Blueprint syntax tier
 * (ADR 0001 Part 3 item 2). The files come from the `pyodide` npm package
 * at build time — nothing is committed to git and nothing is fetched from
 * a CDN at runtime, which keeps the app fully static and offline-capable
 * after the first load. They live under <base>/pyodide/ and are only
 * downloaded when the user opts into the live syntax check (~14 MB).
 */
const PYODIDE_FILES: Record<string, string> = {
  'pyodide.mjs': 'text/javascript',
  'pyodide.asm.mjs': 'text/javascript',
  'pyodide.asm.wasm': 'application/wasm',
  'python_stdlib.zip': 'application/zip',
  'pyodide-lock.json': 'application/json',
}

function pyodideAssets(): Plugin {
  const require = createRequire(import.meta.url)
  const pyodideDir = dirname(require.resolve('pyodide/package.json'))
  return {
    name: 'protota:pyodide-assets',
    // Dev parity: serve the runtime straight from node_modules.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/\/pyodide\/([^/?#]+)/)
        const file = match?.[1]
        if (!file || !(file in PYODIDE_FILES)) return next()
        res.setHeader('Content-Type', PYODIDE_FILES[file])
        res.end(readFileSync(join(pyodideDir, file)))
      })
    },
    // Production: copy the runtime into dist/pyodide/.
    generateBundle() {
      for (const file of Object.keys(PYODIDE_FILES)) {
        this.emitFile({
          type: 'asset',
          fileName: `pyodide/${file}`,
          source: readFileSync(join(pyodideDir, file)),
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pyodideAssets()],
  base: '/protota/',
})
