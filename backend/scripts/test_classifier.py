import sys
from pathlib import Path

# lets this script import from app/
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.ai.slot_classifier import classify

TESTS = {
    "housing_type": ["nag-abang mi og balay", "nakikitira kami sa nanay ko", "sa amin ang bahay",
                     "informal settler kami sa tabing-ilog", "kumusta po"],
    "crisis_type": ["nasunugan kami kahapon", "naospital ang anak ko", "namatay ang tatay ko",
                    "binaha ang bahay namin", "wala po", "nawalan ako ng trabaho bigla"],
}

for key, sentences in TESTS.items():
    print("==", key)
    for s in sentences:
        print(f"  {s} -> {classify(s, key)}")