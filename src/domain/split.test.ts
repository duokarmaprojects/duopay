import { describe, it, expect } from 'vitest';
import { 
  calculateEqualSplit, 
  calculatePercentageSplit, 
  calculateExactSplit, 
  calculateSharesSplit 
} from './money';

describe('Split Domain Functions', () => {
  describe('calculateEqualSplit', () => {
    it('handles exact division', () => {
      const split = calculateEqualSplit(100, ['A', 'B', 'C', 'D']);
      expect(split).toEqual({ A: 25, B: 25, C: 25, D: 25 });
    });

    it('distributes remainder deterministically', () => {
      // 100 / 3 = 33 remainder 1
      const split = calculateEqualSplit(100, ['A', 'B', 'C']);
      expect(split).toEqual({ A: 34, B: 33, C: 33 });
    });

    it('handles large amounts', () => {
      const split = calculateEqualSplit(999, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
      // 999 / 7 = 142 remainder 5
      expect(split).toEqual({ A: 143, B: 143, C: 143, D: 143, E: 143, F: 142, G: 142 });
    });
  });

  describe('calculatePercentageSplit', () => {
    it('calculates 50/30/20 cleanly', () => {
      const split = calculatePercentageSplit(1000, { A: 50, B: 30, C: 20 });
      expect(split).toEqual({ A: 500, B: 300, C: 200 });
    });

    it('distributes remainder correctly for 33/33/34', () => {
      const split = calculatePercentageSplit(100, { A: 33, B: 33, C: 34 });
      expect(split).toEqual({ A: 33, B: 33, C: 34 });
    });

    it('throws if percentages do not sum to 100', () => {
      expect(() => calculatePercentageSplit(1000, { A: 50, B: 30, C: 10 })).toThrowError();
    });
  });

  describe('calculateExactSplit', () => {
    it('accepts valid exact amounts', () => {
      const split = calculateExactSplit(1000, { A: 500, B: 300, C: 200 });
      expect(split).toEqual({ A: 500, B: 300, C: 200 });
    });

    it('rejects if amounts do not match total', () => {
      expect(() => calculateExactSplit(1000, { A: 500, B: 300, C: 100 })).toThrowError();
    });
  });

  describe('calculateSharesSplit', () => {
    it('calculates 2:1:1', () => {
      const split = calculateSharesSplit(1000, { A: 2, B: 1, C: 1 });
      expect(split).toEqual({ A: 500, B: 250, C: 250 });
    });

    it('calculates 3:2:1 (6 shares total)', () => {
      const split = calculateSharesSplit(1200, { A: 3, B: 2, C: 1 });
      expect(split).toEqual({ A: 600, B: 400, C: 200 });
    });

    it('distributes remainder for uneven shares', () => {
      // 100 divided into 3 shares (2 for A, 1 for B)
      // Base: A = 66, B = 33
      // Remainder = 1
      const split = calculateSharesSplit(100, { A: 2, B: 1 });
      // A's fractional part is 66.666 - 66 = 0.666
      // B's fractional part is 33.333 - 33 = 0.333
      // A gets the remainder
      expect(split).toEqual({ A: 67, B: 33 });
    });

    it('rejects negative or 0 shares', () => {
      expect(() => calculateSharesSplit(1000, { A: 1, B: 0 })).toThrowError();
    });
  });
});
