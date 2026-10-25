"use client";
import { useEffect, useState } from "react";
import type { Command, Snapshot } from "@/network/protocol";
import type { Entity } from "@/game/types";
import { portfolioValue, quoteView } from "@/game/market-view";

const contracts = [
  {
    id: "free60",
    name: "Stay free",
    description:
      "Selected protester avoids detention and death for 60 seconds.",
  },
  {
    id: "capture120",
    name: "Crowd takes the Book",
    description:
      "The current Constitution Book objective is captured within 120 seconds.",
  },
  {
    id: "defend120",
    name: "The line holds",
    description:
      "Police complete an actual defense of this objective within 120 seconds.",
  },
  {
    id: "unrest60",
    name: "Unrest holds above 60",
    description: "Unrest is at least 60 at settlement, 60 seconds from now.",
  },
] as const;

export default function MarketDesk({
  snapshot,
  selected,
  disabled,
  notice,
  send,
  onClose,
}: {
  snapshot: Snapshot;
  selected?: Entity;
  disabled: boolean;
  notice: string;
  send: (command: Command) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"quotes" | "predictions" | "supplies">(
    "quotes",
  );
  const [instrument, setInstrument] = useState("calm");
  const [stake, setStake] = useState(5);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  const w = snapshot.world,
    items = w.instruments;
  const item = items.find((i) => i.id === instrument) ?? items[0];
  const symbol = w.map.id === "paris" ? "€" : "₹";
  const money = (value: number) => `${symbol}${value.toFixed(2)}`;
  const holdings = snapshot.holdings;
  const portfolio = portfolioValue(items, holdings);
  const open = snapshot.predictions.filter((p) => p.status === "open");
  const maxStake = Math.min(
    50,
    Math.max(1, Math.floor(snapshot.self.credits * 0.2)),
  );
  const validStake =
    Number.isSafeInteger(stake) &&
    stake >= 1 &&
    stake <= maxStake &&
    stake <= snapshot.self.credits;
  const fundingBlocked =
    open.length > 0 || Object.values(holdings).some((q) => q > 0);
  const deliveries = w.entities.filter(
    (e) => !e.remove && (e.kind === "truck" || e.kind === "crate"),
  );
  const quote = item ? quoteView(item) : null;
  return (
    <section className="market-desk" aria-labelledby="market-desk-title">
      <header className="desk-heading">
        <div>
          <h2 id="market-desk-title">The exchange</h2>
          <p>Spectator desk · Fictional credits only</p>
        </div>
        <button onClick={onClose} aria-label="Close exchange">
          Close ×
        </button>
      </header>
      <p className="desk-notice" role="status">
        {notice || "Live quotes · Orders settle only after server acceptance."}
      </p>
      <nav className="desk-tabs" aria-label="Exchange sections">
        {(
          [
            ["quotes", "Market"],
            ["predictions", "Predictions"],
            ["supplies", "Supply routes"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="desk-content">
        <div className="desk-balance">
          <span>
            Available credits<b>{money(snapshot.self.credits)}</b>
          </span>
          <span>
            Holdings value<b>{money(portfolio)}</b>
          </span>
          <span>
            Open contracts<b>{open.length} / 5</b>
          </span>
        </div>
        {tab === "quotes" &&
          (item && quote ? (
            <>
              <div className="quote-layout">
                <nav className="quote-list" aria-label="Market instruments">
                  {items.map((i) => (
                    <button
                      key={i.id}
                      aria-pressed={i.id === item.id}
                      onClick={() => setInstrument(i.id)}
                    >
                      <span>
                        <b>{i.ticker}</b>
                        <small>{holdings[i.id] ?? 0} held</small>
                      </span>
                      <span>{money(i.price)}</span>
                    </button>
                  ))}
                </nav>
                <article className="quote-detail">
                  <p className="eyebrow">
                    {item.ticker} / LIVE SIMULATION QUOTE
                  </p>
                  <h3>{item.name}</h3>
                  <div className="quote-price">
                    <strong>{money(item.price)}</strong>
                    <span
                      data-direction={
                        quote.change > 0
                          ? "up"
                          : quote.change < 0
                            ? "down"
                            : "flat"
                      }
                    >
                      {quote.change > 0 ? "+" : ""}
                      {quote.percent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="market-actions">
                    <button
                      className="primary"
                      disabled={disabled || snapshot.self.credits < quote.buy}
                      aria-label={`Buy one ${item.name} for approximately ${money(quote.buy)} including fee`}
                      onClick={() =>
                        send({
                          type: "trade",
                          instrument: item.id,
                          quantity: 1,
                        })
                      }
                    >
                      Buy one · {money(quote.buy)}
                    </button>
                    <button
                      disabled={disabled || !(holdings[item.id] > 0)}
                      aria-label={`Sell one ${item.name}`}
                      onClick={() =>
                        send({
                          type: "trade",
                          instrument: item.id,
                          quantity: -1,
                        })
                      }
                    >
                      Sell one · {money(quote.sell)}
                    </button>
                  </div>
                  <p className="muted">
                    Change from the previous quote · {item.desc}
                  </p>
                  <svg
                    className="quote-chart"
                    viewBox="0 0 400 128"
                    role="img"
                    aria-label={`${item.name} recent price history, low ${money(quote.min)}, high ${money(quote.max)}`}
                  >
                    <line x1="4" x2="396" y1="64" y2="64" />
                    <line x1="4" x2="396" y1="116" y2="116" />
                    <path d={quote.path} />
                  </svg>
                  <div className="chart-range">
                    <span>Low {money(quote.min)}</span>
                    <span>{item.history.length} recent quotes</span>
                    <span>High {money(quote.max)}</span>
                  </div>

                  <p className="muted">
                    One unit per order. 2% fee, minimum 1 credit. Market orders
                    fill at the server’s current quote; prices can change before
                    acceptance.
                  </p>
                </article>
              </div>
              <table className="portfolio-table">
                <caption>Your portfolio · current marked value</caption>
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Units</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.ticker}</td>
                      <td>{holdings[i.id] ?? 0}</td>
                      <td>{money(i.price * (holdings[i.id] ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p role="status">Waiting for authoritative market quotes…</p>
          ))}
        {tab === "predictions" && (
          <>
            <p className="muted">
              Contracts pay 2× the stake, including the returned stake. Maximum
              five open contracts, each up to 20% of your available balance.
            </p>
            <label className="inspect-label">
              Stake · maximum {maxStake} credits
              <input
                type="number"
                value={stake}
                min={1}
                max={maxStake}
                step={1}
                onChange={(e) => setStake(Number(e.target.value))}
                aria-invalid={!validStake}
              />
            </label>
            {!validStake && (
              <p role="status" className="muted">
                Enter a whole stake between 1 and {maxStake}, within your
                available balance.
              </p>
            )}
            <div className="prediction-list">
              {contracts.map((c) => {
                const objectiveBlocked =
                  (c.id === "capture120" || c.id === "defend120") &&
                  (!w.objective ||
                    w.objective.status !== "protected" ||
                    w.objective.progress > 0);
                const targetBlocked =
                  c.id === "free60" &&
                  (!selected ||
                    selected.kind !== "protester" ||
                    selected.remove ||
                    ["down", "detained"].includes(selected.state));
                return (
                  <article key={c.id}>
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                    {c.id === "free60" && (
                      <p>
                        {targetBlocked
                          ? "Select an active protester in the city inspector first."
                          : `Selected: ${selected?.name}`}
                      </p>
                    )}
                    {objectiveBlocked && (
                      <p>Opens when a fresh objective is protected.</p>
                    )}
                    <button
                      disabled={
                        disabled ||
                        !validStake ||
                        open.length >= 5 ||
                        objectiveBlocked ||
                        targetBlocked
                      }
                      onClick={() =>
                        send({
                          type: "bet",
                          contract: c.id,
                          stake,
                          ...(c.id === "free60"
                            ? { targetId: selected?.id }
                            : {}),
                        })
                      }
                    >
                      Place {stake || 0}-credit prediction
                    </button>
                  </article>
                );
              })}
            </div>
            <h3>Recent contracts</h3>
            {snapshot.predictions.length ? (
              snapshot.predictions
                .slice(-8)
                .reverse()
                .map((p) => (
                  <div className="desk-record" key={p.id}>
                    <div>
                      {contracts.find((c) => c.id === p.contract)?.name ??
                        p.contract}
                      <br />
                      <span>
                        {p.stake} credits · {p.odds}×
                      </span>
                    </div>
                    <b>
                      {p.status}
                      {p.status === "open"
                        ? ` · ${Math.max(0, Math.ceil(p.deadline - w.time))}s`
                        : ""}
                    </b>
                  </div>
                ))
            ) : (
              <p className="muted">
                No contracts yet. Choose an outcome above; settlement follows
                actual server events.
              </p>
            )}
          </>
        )}
        {tab === "supplies" && (
          <>
            <h3>Back a delivery</h3>
            <p className="muted">
              Fund a truck to replenish a faction’s depot. Each delivery costs
              20 credits and pauses your trades and predictions for 60 seconds.
            </p>
            {fundingBlocked && (
              <p role="status">
                Close your open contracts and sell holdings before funding a
                route.
              </p>
            )}
            <div className="supply-actions">
              <button
                disabled={
                  disabled || fundingBlocked || snapshot.self.credits < 20
                }
                onClick={() => send({ type: "fund", faction: "protester" })}
              >
                Crowd supply · {symbol}20
              </button>
              <button
                disabled={
                  disabled || fundingBlocked || snapshot.self.credits < 20
                }
                onClick={() => send({ type: "fund", faction: "police" })}
              >
                Police supply · {symbol}20
              </button>
            </div>
            <h3>Live deliveries in this city</h3>
            {deliveries.length ? (
              deliveries.map((e) => (
                <div className="desk-record" key={e.id}>
                  <div>
                    {e.truckFaction ?? e.crateFaction ?? "City"} supply #{e.id}
                    <br />
                    <span>
                      World position {Math.round(e.x)}, {Math.round(e.y)}
                    </span>
                  </div>
                  <b>{e.kind === "truck" ? "En route" : "At depot"}</b>
                </div>
              ))
            ) : (
              <p className="muted">
                No active deliveries. A funded truck will appear here and on the
                city map.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
