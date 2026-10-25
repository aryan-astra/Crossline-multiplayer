import type { Instrument } from "./types";

export function quoteView(item: Instrument) {
  const values = item.history.length ? item.history : [item.price];
  const min = Math.min(...values),
    max = Math.max(...values);
  const path = values
    .map(
      (value, index) =>
        `${index ? "L" : "M"}${(4 + (index / Math.max(1, values.length - 1)) * 392).toFixed(2)},${(116 - ((value - min) / (max - min || 1)) * 104).toFixed(2)}`,
    )
    .join(" ");
  const rounded = Math.round(item.price),
    fee = Math.max(1, Math.ceil(rounded * 0.02));
  return {
    min,
    max,
    path,
    buy: rounded + fee,
    sell: rounded - fee,
    change: item.price - item.prev,
    percent: item.prev ? ((item.price - item.prev) / item.prev) * 100 : 0,
  };
}

export function portfolioValue(
  items: Instrument[],
  holdings: Record<string, number>,
) {
  return items.reduce(
    (total, item) => total + item.price * (holdings[item.id] ?? 0),
    0,
  );
}
