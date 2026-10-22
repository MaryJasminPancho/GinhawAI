import sys
from pathlib import Path

# lets this script import from app/
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.ai.slot_classifier import classify

for s in ["Natanggal ako sa trabaho kahapon", "arawan ra ko", "may sari-sari store ako",
          "kumusta po", "wala akong trabaho", "pag harvest lang may work"]:
    print(s, "->", classify(s))