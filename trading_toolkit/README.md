# Wealthsimple Swing Trading Toolkit (Manual Execution)

This toolkit scans for swing setups using Yahoo Finance (`yfinance`), receives TradingView webhook alerts, enriches them with market context from Polygon.io, and prints a manual execution card for Wealthsimple.

## What this does

- **Nightly scan**: Finds trend pullback + breakout candidates from Yahoo Finance data.
- **Alert receiver**: Accepts TradingView webhook JSON payloads.
- **Insight enrichment**: Calls Polygon.io to add context to each alert.
- **Manual execution card**: Produces entry/stop/position-size suggestions; you place trades manually in Wealthsimple.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r trading_toolkit/requirements.txt
cp trading_toolkit/.env.example trading_toolkit/.env
```

Set environment variables in `.env`.

## 1) Run nightly scanner

```bash
python3 trading_toolkit/scanner.py --watchlist AAPL MSFT NVDA SHOP.TO TD.TO
```

Optional:

```bash
python3 trading_toolkit/scanner.py --watchlist-file trading_toolkit/watchlist.txt --risk-cad 300
```

## 2) Run webhook server

```bash
python3 trading_toolkit/webhook_server.py
```

Then use TradingView alert webhook URL:

`http://YOUR_HOST:8000/webhook/tradingview`

## TradingView payload template

```json
{
  "symbol": "AAPL",
  "setup": "trend_pullback",
  "side": "long",
  "price": "{{close}}",
  "timeframe": "{{interval}}",
  "alert_name": "AAPL trend pullback"
}
```

## Notes

- This is educational tooling, not investment advice.
- No strategy can guarantee profits.
- Always validate liquidity, upcoming earnings, and your own risk limits.
