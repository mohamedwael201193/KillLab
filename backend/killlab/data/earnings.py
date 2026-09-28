"""Align earnings timestamps to Bitget bars. Candles are not events by themselves."""

from __future__ import annotations


def symbol_for(instrument: str, venue: str) -> str:
    symbol = instrument if str(instrument).endswith("USDT") else f"{instrument}USDT"
    if venue == "bitget_rtoken" and not symbol.startswith("R"):
        return "R" + symbol
    return symbol


def tag_events(events: list[dict], symbol: str) -> list[dict]:
    tagged = []
    for event in events:
        item = dict(event)
        item["symbol"] = symbol
        item["id"] = f"{symbol}:{event.get('id')}"
        tagged.append(item)
    return tagged


def align_events(rows: list, event_times_ms: list[int], horizon_bars: int = 6) -> list[dict]:
    bars = []
    for row in rows:
        if isinstance(row, list) and len(row) >= 5:
            bars.append((int(row[0]), float(row[4])))
    bars.sort(key=lambda item: item[0])
    events = []
    for stamp in sorted(set(int(item) for item in event_times_ms)):
        index = next((i for i, bar in enumerate(bars) if bar[0] >= stamp), None)
        if index is None or index + horizon_bars >= len(bars):
            continue
        start = bars[index][1]
        impulse_px = bars[index + 1][1]
        end = bars[index + horizon_bars][1]
        if not start or not impulse_px:
            continue
        events.append({
            "id": str(stamp),
            "ts": stamp,
            "impulse_bps": (impulse_px / start - 1.0) * 1e4,
            "hold_bps": (end / impulse_px - 1.0) * 1e4,
            "return_bps": (end / start - 1.0) * 1e4,
        })
    return events


def earnings_timestamps_ms(symbol: str) -> list[int]:
    ticker = symbol.removeprefix("R").removesuffix("USDT")
    try:
        import yfinance as yf
    except ImportError:
        return []
    try:
        frame = yf.Ticker(ticker).get_earnings_dates(limit=16)
    except Exception:
        return []
    if frame is None or getattr(frame, "empty", True):
        return []
    stamps = []
    for value in frame.index:
        try:
            stamps.append(int(value.timestamp() * 1000))
        except Exception:
            continue
    return stamps
