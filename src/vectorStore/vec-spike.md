# Task 6b — sqlite-vec spike & decision

**Goal:** decide whether v1's kNN runs through the `sqlite-vec` extension loaded into
SQLite-WASM (vector search *in SQL*), or through the pure JS brute-force path.

## Decision (v1): ship brute-force kNN; keep `query()` as the SQLite learning surface

`VectorStore.knn()` uses the pure, tested `bruteForceKnn` over the in-memory point set.
The "SQLite-WASM in the browser" learning goal is satisfied today by `VectorStore.query()`
— real SQL (`GROUP BY`, filters, joins) executed by sql.js against the shipped
`emotions.sqlite`. The relational angle is live and tested; see `vectorStore.test.ts`.

### Why brute force is correct at this scale
~1–2k points × 384 dims is ~0.7M multiply-adds per query — sub-millisecond in JS. A vector
index earns its keep at 10⁵–10⁶+ vectors, not 10³. So for v1 brute force is not a
compromise; it's the right engineering choice (and it's the deterministic oracle the
sqlite-vec path would be tested against).

### Why the sqlite-vec integration is deferred (not abandoned)
Loading `sqlite-vec` as a runtime extension into the **sql.js** wasm build is not a settled
path: sql.js does not expose `sqlite3_load_extension`/`auto_extension` by default, so wiring
sqlite-vec in generally means switching to the official `@sqlite.org/sqlite-wasm` (or
`wa-sqlite`) build and statically linking the extension — a real change to verify in both
Safari and Chrome. Doing that for a 10³-vector dataset would be ceremony, and the plan
explicitly lists "keep brute force, document" as an acceptable outcome.

## Forward path (when we scale past ~10k points or want the in-SQL demo)
1. Swap the loader to `@sqlite.org/sqlite-wasm` with `sqlite-vec` statically available.
2. Create a `vec0` virtual table; insert the 384-d vectors.
3. Implement the `useVec` branch in `VectorStore.knn`:
   `SELECT id, distance FROM vec_points WHERE embedding MATCH ? ORDER BY distance LIMIT k`.
4. Add a test asserting the `useVec` path returns the **same ordered ids** as
   `bruteForceKnn` for the fixture DB (brute force is the oracle).
5. Verify the wasm extension loads in real Safari + Chrome before defaulting `useVec` on.

The `Opts.forceFallback` flag and the brute-force oracle are already in place to make this a
purely additive change.
