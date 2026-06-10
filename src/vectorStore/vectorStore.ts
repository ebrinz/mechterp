import initSqlJs, { type Database, type SqlJsConfig } from 'sql.js'
import type { Point, Neighbor, Vec384, XYZ } from '../types'
import { bruteForceKnn } from './cosine'

function unpackVec(blob: Uint8Array): Vec384 {
  // Copy into a fresh buffer so the typed array is independent of the source bytes.
  return new Float32Array(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength))
}

interface Opts {
  forceFallback?: boolean
  locateFile?: (file: string) => string  // browser supplies this; tests omit it
}

export class VectorStore {
  private constructor(
    private db: Database,
    private points: Point[],
  ) {}

  static async fromBytes(bytes: Uint8Array, opts: Opts = {}): Promise<VectorStore> {
    const config: SqlJsConfig = {}
    if (opts.locateFile) config.locateFile = opts.locateFile
    const SQL = await initSqlJs(config)
    const db = new SQL.Database(bytes)
    const points: Point[] = []
    const stmt = db.prepare('SELECT id, text, emotion, x, y, z, vec FROM points')
    while (stmt.step()) {
      const r = stmt.getAsObject() as any
      points.push({
        id: r.id, text: r.text, emotion: r.emotion,
        xyz: [r.x, r.y, r.z] as XYZ, vec: unpackVec(r.vec as Uint8Array),
      })
    }
    stmt.free()
    return new VectorStore(db, points)
  }

  static async fromUrl(url: string, opts: Opts = {}): Promise<VectorStore> {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer())
    return VectorStore.fromBytes(buf, { locateFile: (f) => `/sql-wasm/${f}`, ...opts })
  }

  /** Nearest neighbors. v1 uses the pure brute-force path; Task 6b may add a sqlite-vec path. */
  knn(query: Vec384, k: number): Neighbor[] {
    return bruteForceKnn(query, this.points, k)
  }

  query(sql: string): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = []
    const stmt = this.db.prepare(sql)
    while (stmt.step()) out.push(stmt.getAsObject())
    stmt.free()
    return out
  }

  centroids(): { emotion: string; xyz: XYZ }[] {
    return this.query('SELECT emotion, x, y, z FROM centroids').map((r: any) => ({
      emotion: r.emotion, xyz: [r.x, r.y, r.z] as XYZ,
    }))
  }

  count(): number { return this.points.length }
  all(): Point[] { return this.points }
}
