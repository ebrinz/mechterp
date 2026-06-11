// Copy sql.js's wasm into public/ so the browser can load SQLite-WASM.
// Runs before dev/build so a fresh clone (and Vercel) self-provisions the artifact
// instead of relying on a manual cp. The wasm itself stays git-ignored.
import { mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/sql.js/dist/sql-wasm.wasm')
const destDir = resolve(root, 'public/sql-wasm')
const dest = resolve(destDir, 'sql-wasm.wasm')

mkdirSync(destDir, { recursive: true })
copyFileSync(src, dest)
console.log(`copied ${src} -> ${dest}`)
