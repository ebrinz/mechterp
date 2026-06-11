"""Re-export all-MiniLM-L6-v2 to ONNX exposing hidden_states + attentions.

v1 only consumes the final embedding, but B (layer trajectory) and C (attention
patterns) need these internal outputs in the graph, so we bake them in now.
Output: pipeline/../public/models/minilm-internals/model.onnx (+ tokenizer files)
"""
from pathlib import Path
import torch
from transformers import AutoModel, AutoTokenizer

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "models" / "minilm-internals"


class MiniLMWithInternals(torch.nn.Module):
    """Wrap the encoder so ONNX outputs last_hidden_state + all hidden_states + attentions."""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask, token_type_ids):
        out = self.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
            output_hidden_states=True,
            output_attentions=True,
        )
        # hidden_states: tuple(len 7) -> stack to (7, B, T, 384)
        # attentions:    tuple(len 6) -> stack to (6, B, 12, T, T)
        hidden = torch.stack(out.hidden_states, dim=0)
        attn = torch.stack(out.attentions, dim=0)
        return out.last_hidden_state, hidden, attn


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tok = AutoTokenizer.from_pretrained(MODEL_ID)
    base = AutoModel.from_pretrained(MODEL_ID).eval()
    wrapped = MiniLMWithInternals(base).eval()

    enc = tok("export trace sentence", return_tensors="pt")
    args = (enc["input_ids"], enc["attention_mask"], enc["token_type_ids"])

    torch.onnx.export(
        wrapped,
        args,
        str(OUT_DIR / "model.onnx"),
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["last_hidden_state", "hidden_states", "attentions"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "token_type_ids": {0: "batch", 1: "seq"},
            "last_hidden_state": {0: "batch", 1: "seq"},
            "hidden_states": {1: "batch", 2: "seq"},
            "attentions": {1: "batch", 3: "seq", 4: "seq"},
        },
        opset_version=14,
    )
    tok.save_pretrained(OUT_DIR)
    print(f"Wrote ONNX + tokenizer to {OUT_DIR}")


if __name__ == "__main__":
    main()
