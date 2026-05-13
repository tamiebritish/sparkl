#!/usr/bin/env python3
"""Swing setup scanner using Yahoo Finance data."""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass

import pandas as pd
import yfinance as yf
from dotenv import load_dotenv


@dataclass
class SetupCard:
    symbol: str
    setup: str
    side: str
    entry: float
    stop: float
    risk_per_share: float
    position_size: int
    notes: str


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = losses.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, pd.NA)
    return 100 - (100 / (1 + rs))


def load_watchlist(args: argparse.Namespace) -> list[str]:
    if args.watchlist:
        return args.watchlist
    if args.watchlist_file:
        with open(args.watchlist_file, "r", encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip() and not line.startswith("#")]
    raise ValueError("Provide --watchlist or --watchlist-file")


def trend_pullback_card(df: pd.DataFrame, symbol: str, risk_cad: float) -> SetupCard | None:
    if len(df) < 220:
        return None

    close = df["Close"]
    high = df["High"]
    low = df["Low"]

    ema20 = ema(close, 20)
    ema50 = ema(close, 50)
    ema200 = ema(close, 200)
    rsi14 = rsi(close, 14)

    latest = df.iloc[-1]
    prev = df.iloc[-2]

    trend_ok = close.iloc[-1] > ema200.iloc[-1] and ema50.iloc[-1] > ema50.iloc[-6]
    pullback_ok = low.iloc[-1] <= ema20.iloc[-1] * 1.01 and close.iloc[-1] >= ema20.iloc[-1] * 0.98
    momentum_reset = 38 <= rsi14.iloc[-1] <= 55
    trigger = close.iloc[-1] > high.iloc[-2]

    if not (trend_ok and pullback_ok and momentum_reset and trigger):
        return None

    entry = float(close.iloc[-1])
    stop = float(min(low.iloc[-1], low.iloc[-2]))
    risk_per_share = max(entry - stop, 0.01)
    qty = int(risk_cad / risk_per_share)

    if qty <= 0:
        return None

    return SetupCard(
        symbol=symbol,
        setup="trend_pullback",
        side="long",
        entry=entry,
        stop=stop,
        risk_per_share=risk_per_share,
        position_size=qty,
        notes=(
            f"Close {latest['Close']:.2f} > prev high {prev['High']:.2f}; "
            f"RSI14 {rsi14.iloc[-1]:.1f}; EMA50 slope positive"
        ),
    )


def breakout_card(df: pd.DataFrame, symbol: str, risk_cad: float) -> SetupCard | None:
    if len(df) < 120:
        return None

    close = df["Close"]
    high = df["High"]
    low = df["Low"]

    lookback = 20
    recent_high = high.iloc[-(lookback + 1) : -1].max()
    recent_low = low.iloc[-(lookback + 1) : -1].min()

    range_pct = (recent_high - recent_low) / max(recent_low, 0.01)
    breakout = close.iloc[-1] > recent_high
    tight_range = range_pct < 0.12

    if not (breakout and tight_range):
        return None

    entry = float(close.iloc[-1])
    stop = float(low.iloc[-1])
    risk_per_share = max(entry - stop, 0.01)
    qty = int(risk_cad / risk_per_share)

    if qty <= 0:
        return None

    return SetupCard(
        symbol=symbol,
        setup="volatility_contraction_breakout",
        side="long",
        entry=entry,
        stop=stop,
        risk_per_share=risk_per_share,
        position_size=qty,
        notes=f"20-day range {range_pct:.1%}; breakout above {recent_high:.2f}",
    )


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Scan watchlist for swing setups")
    parser.add_argument("--watchlist", nargs="*", help="Space-separated tickers")
    parser.add_argument("--watchlist-file", help="Path to newline-delimited ticker list")
    parser.add_argument("--risk-cad", type=float, default=float(os.getenv("RISK_PER_TRADE_CAD", "300")))
    parser.add_argument("--period", default="1y")
    args = parser.parse_args()

    watchlist = load_watchlist(args)
    cards: list[SetupCard] = []

    for symbol in watchlist:
        df = yf.download(symbol, period=args.period, interval="1d", progress=False, auto_adjust=False)
        if df.empty:
            continue
        df = df.dropna()
        tpc = trend_pullback_card(df, symbol, args.risk_cad)
        boc = breakout_card(df, symbol, args.risk_cad)
        for card in (tpc, boc):
            if card:
                cards.append(card)

    if not cards:
        print("No setups found today.")
        return

    print("\nSwing setup candidates\n" + "=" * 70)
    for c in cards:
        print(
            f"{c.symbol:8} | {c.setup:32} | entry {c.entry:9.2f} | stop {c.stop:9.2f} "
            f"| risk/share {c.risk_per_share:7.2f} | qty {c.position_size:6d}"
        )
        print(f"  notes: {c.notes}")


if __name__ == "__main__":
    main()
