"""int8-quantize the internals ONNX so it's small enough to ship same-origin (~90MB -> ~23MB).

Run after export_onnx.py (needs public/models/minilm-internals/model.onnx):
    cd pipeline && . .venv/bin/activate && python quantize_onnx.py
"""
from pathlib import Path
from onnxruntime.quantization import quantize_dynamic, QuantType

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "models" / "minilm-internals" / "model.onnx"
DST = ROOT / "public" / "models" / "minilm-internals" / "model.q8.onnx"


def main():
    quantize_dynamic(str(SRC), str(DST), weight_type=QuantType.QInt8)
    mb = DST.stat().st_size / 1e6
    print(f"Wrote {DST} ({mb:.1f} MB)")


if __name__ == "__main__":
    main()
