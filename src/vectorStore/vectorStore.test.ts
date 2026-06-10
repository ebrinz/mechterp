// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import initSqlJs from 'sql.js'
import { VectorStore } from './vectorStore'

function packVec(arr: number[]): Uint8Array {
  const f = Float32Array.from(arr)
  return new Uint8Array(f.buffer)
}

let dbBytes: Uint8Array

beforeAll(async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('CREATE TABLE points (id INTEGER PRIMARY KEY, text TEXT, emotion TEXT, x REAL, y REAL, z REAL, vec BLOB)')
  db.run('CREATE TABLE centroids (emotion TEXT PRIMARY KEY, x REAL, y REAL, z REAL)')
  const ins = db.prepare('INSERT INTO points VALUES (?,?,?,?,?,?,?)')
  ins.run([1, 'a', 'joy', 0, 0, 0, packVec([1, 0])])
  ins.run([2, 'b', 'fear', 1, 1, 1, packVec([0, 1])])
  ins.run([3, 'c', 'joy', 0.1, 0, 0, packVec([0.9, 0.1])])
  ins.free()
  dbBytes = db.export()
})

describe('VectorStore', () => {
  it('loads points and returns nearest neighbors (fallback path)', async () => {
    const store = await VectorStore.fromBytes(dbBytes, { forceFallback: true })
    const res = store.knn(Float32Array.from([1, 0]), 2)
    expect(res.map(r => r.id)).toEqual([1, 3])
  })

  it('exposes relational query()', async () => {
    const store = await VectorStore.fromBytes(dbBytes, { forceFallback: true })
    const rows = store.query("SELECT emotion, COUNT(*) c FROM points GROUP BY emotion ORDER BY emotion")
    expect(rows).toEqual([{ emotion: 'fear', c: 1 }, { emotion: 'joy', c: 2 }])
  })

  it('reads centroids (none inserted -> empty array, shape check)', async () => {
    const store = await VectorStore.fromBytes(dbBytes, { forceFallback: true })
    expect(store.centroids().length).toBe(0)
  })
})
