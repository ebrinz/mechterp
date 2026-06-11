# Pipeline — offline asset build (run once)

These scripts produce the two static assets the browser app loads. They are **run-once on a
dev machine** and their large binary outputs are git-ignored (regenerate locally).

## Outputs (git-ignored)
- `public/emotions.sqlite` — reference points (id, text, emotion, 3D coords, 384-d vector
  BLOB) + per-emotion centroids.
- `public/models/minilm-internals/` — ONNX re-export of `all-MiniLM-L6-v2` exposing
  `hidden_states` + `attentions` (forward-compat for the B/C internals views; unused in v1).

## Run it
```bash
cd pipeline
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

python export_onnx.py        # -> public/models/minilm-internals/model.onnx (+ tokenizer)
python build_dataset.py      # -> public/emotions.sqlite

pytest tests/test_outputs.py -v   # asserts the data contract + that ONNX exposes internals
```

Notes:
- `export_onnx.py` downloads `all-MiniLM-L6-v2` from HuggingFace (~90 MB) and forces the
  legacy TorchScript ONNX exporter (`dynamo=False`) so the `dynamic_axes` are honored.
- `build_dataset.py` pulls GoEmotions' "simplified" train split from **Google's GitHub TSV**
  (not the HF datasets API — that endpoint aggressively rate-limits shared/public IPs), and
  loads the embedding model from the local HF cache. Once the model is cached you can run it
  fully offline to dodge any HF throttling:
  ```bash
  HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python build_dataset.py
  ```
- Deterministic (`SEED=42`). Produced 1650 points across all 28 emotions in the reference run.

## Knobs
- `PER_EMOTION` in `build_dataset.py` (default 60 → ~1.7k points). Lower it if an iPhone
  smoke test shows memory pressure; raise it for a richer (muddier) cloud.
- UMAP is **unsupervised** on purpose — it shows the real, partly-overlapping emotion
  structure rather than faking clean clusters. Don't switch to supervised without revisiting
  the teaching thesis in the spec.
