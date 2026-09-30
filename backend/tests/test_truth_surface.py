import inspect
import json
import re
from pathlib import Path

from killlab.ai.compile import family_from_text
from killlab.engine.traps import REGISTERED_DETECTORS, scan


def test_family_phrases_match_the_shared_file():
    rows = json.loads((Path(__file__).resolve().parents[2] / "shared" / "routing_phrases.json").read_text(encoding="utf-8"))
    assert rows
    for row in rows:
        assert family_from_text(row["text"], None) == row["family"]


def test_scan_calls_exactly_the_registered_detectors():
    called = set(re.findall(r"trap_[a-z_]+", inspect.getsource(scan)))
    assert called == set(REGISTERED_DETECTORS)
