/**
 * Applies a percentage discount to a price.
 * Percent above 100 is clamped to 100, so the result is never negative.
 * Throws for a negative price.
 */
export function applyDiscount(price: number, percent: number): number {
  if (price < 0) {
    throw new RangeError('price must not be negative');
  }
  const clamped = percent > 100 ? 100 : percent;
  return price - (price * clamped) / 100;
}
