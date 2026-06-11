// Copy sql.js's wasm into public/ so the browser can load SQLite-WASM.
// Runs before dev/build so a fresh clone (and Vercel) self-provisions the artifact
// instead of relying on a manual cp. The wasm itself stays git-ignored.
//
// IMPORTANT: sql.js's package.json has a "browser" export condition that resolves to
// dist/sql-wasm-browser.js, which requests `sql-wasm-browser.wasm` at runtime. Vite uses
// that browser build, so we MUST ship `sql-wasm-browser.wasm`. We copy the plain
// `sql-wasm.wasm` too for robustness against either resolution.
import { mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = resolve(root, 'node_modules/sql.js/dist')
const destDir = resolve(root, 'public/sql-wasm')

mkdirSync(destDir, { recursive: true })
for (const file of ['sql-wasm-browser.wasm', 'sql-wasm.wasm']) {
  copyFileSync(resolve(srcDir, file), resolve(destDir, file))
  console.log(`copied ${file} -> public/sql-wasm/${file}`)
}
