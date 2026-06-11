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
python build_dataset.py      # -> public/emotions.sqlite  (downloads GoEmotions + the model)

pytest tests/test_outputs.py -v   # asserts the data contract + that ONNX exposes internals
```

Heads-up: the first run downloads PyTorch, the model (~90 MB), and the GoEmotions dataset,
then runs UMAP — do it on a good network. `build_dataset.py` is deterministic (`SEED=42`).

## Knobs
- `PER_EMOTION` in `build_dataset.py` (default 60 → ~1.7k points). Lower it if an iPhone
  smoke test shows memory pressure; raise it for a richer (muddier) cloud.
- UMAP is **unsupervised** on purpose — it shows the real, partly-overlapping emotion
  structure rather than faking clean clusters. Don't switch to supervised without revisiting
  the teaching thesis in the spec.
