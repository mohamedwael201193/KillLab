export function reconcileFieldError(buy: string, sell: string): string | null {
  if (!buy.trim() || !sell.trim()) return "Enter both a buy price and a sell price.";
  const buyPx = Number(buy);
  const sellPx = Number(sell);
  if (!Number.isFinite(buyPx) || !Number.isFinite(sellPx) || buyPx <= 0 || sellPx <= 0) {
    return "Prices must be numbers above zero.";
  }
  return null;
}
