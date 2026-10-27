"""Loads the fine-tuned XLM-RoBERTa models (one per slot) and classifies one citizen answer."""
from pathlib import Path

# torch and transformers are imported inside the functions, so the backend still starts on a
# machine without them (or without the model files); the chat then falls back to Gemini.

# app/ai/slot_classifier.py -> parents[2] is the backend/ folder
MODELS_DIR = Path(__file__).resolve().parents[2] / "models"

# model key -> folder name inside backend/models/
MODEL_FOLDERS = {
    "employment_status": "employment_model",
    "housing_type": "housing_type_model",
    "crisis_type": "crisis_type_model",
    "yes_no": "yes_no_model",   # shared by has_children_0_18, has_pwd, is_solo_parent
}

_loaded = {}  # model key -> (tokenizer, model); each model loads once, then is reused


def load_model(key: str = "employment_status"):
    if key not in _loaded:
        # imported here (not at the top) so a missing torch/transformers does not stop the backend
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        path = str(MODELS_DIR / MODEL_FOLDERS[key])
        tok = AutoTokenizer.from_pretrained(path)
        mdl = AutoModelForSequenceClassification.from_pretrained(path)
        mdl.eval()
        _loaded[key] = (tok, mdl)
    return _loaded[key]


def classify(text: str, key: str = "employment_status") -> tuple[str, float]:
    """Returns (label, confidence from 0 to 1). The caller decides what confidence is good enough."""
    import torch

    tok, mdl = load_model(key)
    enc = tok(text, return_tensors="pt", truncation=True, max_length=64)
    with torch.no_grad():
        probs = torch.softmax(mdl(**enc).logits, dim=-1)[0]
    conf, i = probs.max(dim=-1)
    return mdl.config.id2label[i.item()], round(conf.item(), 3)