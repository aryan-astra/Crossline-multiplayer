import type { Instrument } from "./types";

export function quoteView(item: Instrument) {
  const values = item.history.length ? item.history : [item.price];
  const min = Math.min(...values),
    max = Math.max(...values);
  const chartMin = Math.min(min, item.price * 0.95),
    chartMax = Math.max(max, item.price * 1.05);
  const y = (value: number) =>
    116 - ((value - chartMin) / (chartMax - chartMin || 1)) * 104;
  const stride = Math.max(1, Math.ceil(values.length / 20));
  const candles = Array.from(
    { length: Math.ceil(values.length / stride) },
    (_, index) => {
      const group = values.slice(index * stride, (index + 1) * stride);
      const open = group[0],
        close = group.at(-1)!;
      return {
        x:
          8 +
          (index / Math.max(1, Math.ceil(values.length / stride) - 1)) * 384,
        open,
        close,
        high: Math.max(...group),
        low: Math.min(...group),
        top: y(Math.max(open, close)),
        bottom: y(Math.min(open, close)),
        highY: y(Math.max(...group)),
        lowY: y(Math.min(...group)),
      };
    },
  );
  const path = values
    .map(
      (value, index) =>
        `${index ? "L" : "M"}${(4 + (index / Math.max(1, values.length - 1)) * 392).toFixed(2)},${y(value).toFixed(2)}`,
    )
    .join(" ");
  const rounded = Math.round(item.price),
    fee = Math.max(1, Math.ceil(rounded * 0.02));
  return {
    min,
    max,
    path,
    candles,
    chartMin,
    chartMax,
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
