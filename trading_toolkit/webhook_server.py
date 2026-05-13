#!/usr/bin/env python3
"""TradingView webhook listener with Polygon insight enrichment."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, Field

load_dotenv()
app = FastAPI(title="Wealthsimple Swing Insight API", version="0.1.0")


class TradingViewAlert(BaseModel):
    symbol: str = Field(..., description="Ticker, e.g. AAPL or SHOP.TO")
    setup: str = Field(default="unknown")
    side: str = Field(default="long")
    price: float
    timeframe: str = Field(default="1D")
    alert_name: str = Field(default="unnamed_alert")


def polygon_snapshot(symbol: str) -> dict:
    key = os.getenv("POLYGON_API_KEY")
    if not key:
        return {"warning": "POLYGON_API_KEY not set"}

    url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/prev"
    resp = requests.get(url, params={"adjusted": "true", "apiKey": key}, timeout=15)
    if resp.status_code != 200:
        return {"warning": f"Polygon request failed ({resp.status_code})"}
    data = resp.json()
    results = data.get("results", [])
    if not results:
        return {"warning": "No Polygon data returned"}

    bar = results[0]
    return {
        "prev_close": bar.get("c"),
        "prev_high": bar.get("h"),
        "prev_low": bar.get("l"),
        "prev_volume": bar.get("v"),
    }


def risk_card(alert: TradingViewAlert, insight: dict) -> dict:
    account_risk_cad = float(os.getenv("RISK_PER_TRADE_CAD", "300"))
    stop_buffer_pct = 0.02

    entry = alert.price
    stop = round(entry * (1 - stop_buffer_pct), 2) if alert.side.lower() == "long" else round(entry * (1 + stop_buffer_pct), 2)
    risk_per_share = abs(entry - stop)
    qty = int(account_risk_cad / risk_per_share) if risk_per_share > 0 else 0

    return {
        "symbol": alert.symbol,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "setup": alert.setup,
        "side": alert.side,
        "entry": round(entry, 2),
        "stop": stop,
        "risk_per_share": round(risk_per_share, 2),
        "position_size_shares": qty,
        "target_2r": round(entry + 2 * risk_per_share, 2) if alert.side.lower() == "long" else round(entry - 2 * risk_per_share, 2),
        "insight": insight,
        "manual_execution_note": "Place trade manually in Wealthsimple only if checklist passes.",
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/webhook/tradingview")
def tradingview_webhook(alert: TradingViewAlert) -> dict:
    insight = polygon_snapshot(alert.symbol)
    card = risk_card(alert, insight)
    return {"received": True, "decision_card": card}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("webhook_server:app", host="0.0.0.0", port=8000, reload=False)
