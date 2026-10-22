"""Loads the fine-tuned XLM-RoBERTa model and classifies one citizen answer."""
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# app/ai/slot_classifier.py -> parents[2] is the backend/ folder
MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / "employment_model"

_tokenizer = None
_model = None


def load_model():
    # Loads once, then reuses. The first call takes a few seconds.
    global _tokenizer, _model
    if _model is None:
        _tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
        _model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
        _model.eval()


def classify(text: str) -> tuple[str, float]:
    """Returns (label, confidence from 0 to 1). The caller decides what confidence is good enough."""
    load_model()
    enc = _tokenizer(text, return_tensors="pt", truncation=True, max_length=64)
    with torch.no_grad():
        probs = torch.softmax(_model(**enc).logits, dim=-1)[0]
    conf, i = probs.max(dim=-1)
    return _model.config.id2label[i.item()], round(conf.item(), 3)