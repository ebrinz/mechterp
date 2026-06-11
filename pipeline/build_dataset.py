"""GoEmotions -> high-agreement single-label -> stratify ~N -> embed -> UMAP3D -> emotions.sqlite.

We deliberately keep this small (~1-2k) and emotion-balanced for legibility.
UMAP is UNSUPERVISED on purpose: we want the real (messy) structure, not faked separation.
"""
import sqlite3
import struct
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np
import umap
from sentence_transformers import SentenceTransformer

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
PER_EMOTION = 60          # ~60 * 28 emotions -> ~1.7k single-label examples
OUT_DB = Path(__file__).resolve().parent.parent / "public" / "emotions.sqlite"
SEED = 42

# GoEmotions 'simplified' train split, served from Google's GitHub (not HF) so it is not
# subject to the HuggingFace metadata-API IP throttling. Format per line:
#   text <TAB> comma-separated emotion indices <TAB> comment_id
TSV_URL = "https://raw.githubusercontent.com/google-research/google-research/master/goemotions/data/train.tsv"

# Canonical GoEmotions label order (index -> name); matches src/scene/colors.ts EMOTIONS.
GOEMOTIONS_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring", "confusion",
    "curiosity", "desire", "disappointment", "disapproval", "disgust", "embarrassment",
    "excitement", "fear", "gratitude", "grief", "joy", "love", "nervousness", "optimism",
    "pride", "realization", "relief", "remorse", "sadness", "surprise", "neutral",
]


def load_balanced():
    """Fetch the GoEmotions simplified train TSV from GitHub and stratify single-label examples.

    Single-label (exactly one emotion index) gives unambiguous teaching examples; we cap each
    emotion at PER_EMOTION for a balanced, legible reference cloud.
    """
    with urllib.request.urlopen(TSV_URL, timeout=60) as resp:
        raw = resp.read().decode("utf-8")

    buckets = defaultdict(list)
    for line in raw.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        text, label_field, _id = parts
        label_ids = label_field.split(",")
        if len(label_ids) != 1:     # single-label only -> unambiguous teaching examples
            continue
        emo = GOEMOTIONS_LABELS[int(label_ids[0])]
        if len(buckets[emo]) < PER_EMOTION:
            buckets[emo].append(text)

    texts, emotions = [], []
    for emo, items in buckets.items():
        for t in items:
            texts.append(t)
            emotions.append(emo)
    return texts, emotions, GOEMOTIONS_LABELS


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
