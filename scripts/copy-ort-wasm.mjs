// Copy onnxruntime-web's wasm/mjs runtime into public/ort/ so the browser can load it
// same-origin (ort.env.wasm.wasmPaths = '/ort/'). Runs before dev/build; the files stay git-ignored.
import { mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/onnxruntime-web/dist')
const dest = resolve(root, 'public/ort')

mkdirSync(dest, { recursive: true })
let n = 0
for (const f of readdirSync(src)) {
  if (f.endsWith('.wasm') || f.endsWith('.mjs')) {
    copyFileSync(resolve(src, f), resolve(dest, f))
    n++
  }
}
console.log(`copied ${n} onnxruntime-web runtime files -> public/ort/`)
