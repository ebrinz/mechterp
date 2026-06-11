"""Output assertions for the pipeline build.

Run AFTER `python export_onnx.py` and `python build_dataset.py`:
    pytest tests/test_outputs.py -v
These guard the data contract the browser app depends on, including the B/C
prerequisite that the ONNX export exposes hidden_states + attentions.
"""
import sqlite3
import struct
from pathlib import Path

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parent.parent.parent
DB = ROOT / "public" / "emotions.sqlite"
ONNX = ROOT / "public" / "models" / "minilm-internals" / "model.onnx"


def test_db_has_points_with_vectors_and_coords():
    con = sqlite3.connect(DB)
    rows = con.execute("SELECT x, y, z, vec FROM points").fetchall()
    assert len(rows) > 500
    for x, y, z, blob in rows:
        assert all(v is not None for v in (x, y, z))
        vec = struct.unpack(f"<{len(blob) // 4}f", blob)
        assert len(vec) == 384


def test_all_emotions_present():
    con = sqlite3.connect(DB)
    n = con.execute("SELECT COUNT(DISTINCT emotion) FROM points").fetchone()[0]
    assert n == 28


def test_onnx_exposes_internals():
    sess = ort.InferenceSession(str(ONNX))
    out_names = {o.name for o in sess.get_outputs()}
    assert {"last_hidden_state", "hidden_states", "attentions"} <= out_names
    feed = {
        "input_ids": np.array([[101, 2023, 102]], dtype=np.int64),
        "attention_mask": np.ones((1, 3), dtype=np.int64),
        "token_type_ids": np.zeros((1, 3), dtype=np.int64),
    }
    last, hidden, attn = sess.run(["last_hidden_state", "hidden_states", "attentions"], feed)
    assert hidden.shape[0] == 7 and hidden.shape[-1] == 384   # 6 layers + embeddings
    assert attn.shape[0] == 6 and attn.shape[2] == 12         # 6 layers, 12 heads
