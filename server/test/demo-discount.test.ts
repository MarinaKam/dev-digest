import { describe, it, expect } from 'vitest';
import { applyDiscount } from '../src/modules/pulls/discount.js';

describe('applyDiscount', () => {
  it('applies a 10 percent discount to a positive price', () => {
    expect(applyDiscount(200, 10)).toBe(180);
  });
});
