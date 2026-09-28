import pytest

from killlab.config import settings_from_environ
from killlab.data.bitget import BitgetRest


@pytest.mark.live
def test_live_nvda_perp_has_a_floor():
    client = BitgetRest(settings_from_environ())
    snapshot = client.history_candles(frozen=True, product="USDT-FUTURES", symbol="NVDAUSDT", pages=1)
    assert snapshot["n"] > 0
    assert snapshot["actual_first"]
    assert len(snapshot["payload_sha256"]) == 64
