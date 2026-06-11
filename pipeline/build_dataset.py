"""GoEmotions -> high-agreement single-label -> stratify ~N -> embed -> UMAP3D -> emotions.sqlite.

We deliberately keep this small (~1-2k) and emotion-balanced for legibility.
UMAP is UNSUPERVISED on purpose: we want the real (messy) structure, not faked separation.
"""
import sqlite3
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np
import umap
from datasets import load_dataset
from sentence_transformers import SentenceTransformer

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
PER_EMOTION = 60          # ~60 * 28 emotions -> ~1.7k single-label examples
OUT_DB = Path(__file__).resolve().parent.parent / "public" / "emotions.sqlite"
SEED = 42


def _load_go_emotions():
    """Load GoEmotions, retrying on HF API 429 rate-limits with backoff.

    A single call path (trust_remote_code=True is accepted on datasets>=2.16 and ignored
    for parquet-backed datasets) avoids doubling the API hits that trigger throttling.
    """
    import time

    from huggingface_hub.errors import HfHubHTTPError

    last = None
    for attempt in range(6):
        try:
            return load_dataset("go_emotions", "simplified", split="train", trust_remote_code=True)
        except TypeError:
            # datasets version without the trust_remote_code kwarg
            return load_dataset("go_emotions", "simplified", split="train")
        except HfHubHTTPError as e:
            last = e
            if "429" in str(e):
                wait = 20 * (attempt + 1)
                print(f"HF 429 rate-limited; waiting {wait}s (attempt {attempt + 1}/6)")
                time.sleep(wait)
                continue
            raise
    raise last


def load_balanced():
    """GoEmotions 'simplified': features.labels is a sequence of ClassLabel; single-label = exactly one."""
    ds = _load_go_emotions()
    names = ds.features["labels"].feature.names  # 28 emotion names
    buckets = defaultdict(list)
    for row in ds:
        labels = row["labels"]
        if len(labels) != 1:        # single-label only -> unambiguous teaching examples
            continue
        emo = names[labels[0]]
        if len(buckets[emo]) < PER_EMOTION:
            buckets[emo].append(row["text"])
    texts, emotions = [], []
    for emo, items in buckets.items():
        for t in items:
            texts.append(t)
            emotions.append(emo)
    return texts, emotions, names


def pack_vec(v: np.ndarray) -> bytes:
    return struct.pack(f"<{v.shape[0]}f", *v.astype(np.float32).tolist())


def main():
    texts, emotions, _ = load_balanced()
    model = SentenceTransformer(MODEL_ID)
    vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    vecs = np.asarray(vecs, dtype=np.float32)

    reducer = umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.1, random_state=SEED)
    coords = reducer.fit_transform(vecs).astype(np.float32)

    # per-emotion centroids in 3D (landmarks)
    cents = {}
    emo_arr = np.array(emotions)
    for emo in sorted(set(emotions)):
        cents[emo] = coords[emo_arr == emo].mean(axis=0)

    OUT_DB.parent.mkdir(parents=True, exist_ok=True)
    if OUT_DB.exists():
        OUT_DB.unlink()
    con = sqlite3.connect(OUT_DB)
    con.execute(
        "CREATE TABLE points (id INTEGER PRIMARY KEY, text TEXT, emotion TEXT, x REAL, y REAL, z REAL, vec BLOB)"
    )
    con.execute("CREATE TABLE centroids (emotion TEXT PRIMARY KEY, x REAL, y REAL, z REAL)")
    for i, (t, emo) in enumerate(zip(texts, emotions)):
        con.execute(
            "INSERT INTO points VALUES (?,?,?,?,?,?,?)",
            (i, t, emo, float(coords[i, 0]), float(coords[i, 1]), float(coords[i, 2]), pack_vec(vecs[i])),
        )
    for emo, c in cents.items():
        con.execute("INSERT INTO centroids VALUES (?,?,?,?)", (emo, float(c[0]), float(c[1]), float(c[2])))
    con.commit()
    con.close()
    print(f"Wrote {len(texts)} points across {len(set(emotions))} emotions to {OUT_DB}")


if __name__ == "__main__":
    main()
