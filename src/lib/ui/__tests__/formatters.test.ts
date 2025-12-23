/**
 * Formatters Tests
 */

import { describe, expect, it } from '@jest/globals';
import { formatCurrency } from '../formatters';

const toNumber = (formatted: string): number => {
  // Normalize locale-specific separators into a parsable number
  const normalized = formatted.replace(/\u2212/g, '-');
  const isParenNegative = /\(.*\)/.test(normalized);
  const numeric = normalized.replace(/[^0-9.,-]/g, '');
  const hasCommaAsDecimal = numeric.includes(',') && numeric.lastIndexOf(',') > numeric.lastIndexOf('.');
  if (hasCommaAsDecimal) {
    const value = parseFloat(numeric.replace(/\./g, '').replace(',', '.'));
    return isParenNegative ? -value : value;
  }
  const value = parseFloat(numeric.replace(/,/g, ''));
  return isParenNegative ? -value : value;
};

describe('formatCurrency', () => {
  it('should format USD currency correctly', () => {
    const result = formatCurrency(1234.56, 'USD');
    expect(toNumber(result)).toBeCloseTo(1234.56, 2);
  });

  it('should format EUR currency correctly', () => {
    const result = formatCurrency(1000, 'EUR');
    expect(toNumber(result)).toBeCloseTo(1000, 2);
  });

  it('should handle zero value', () => {
    const result = formatCurrency(0, 'USD');
    expect(toNumber(result)).toBe(0);
  });

  it('should handle negative values', () => {
    const result = formatCurrency(-100, 'USD');
    const value = toNumber(result);
    expect(value).toBeCloseTo(-100, 2);
  });

  it('should handle invalid currency gracefully', () => {
    const result = formatCurrency(100, 'INVALID');
    expect(toNumber(result)).toBeCloseTo(100, 2);
  });

  it('should handle null/undefined value', () => {
    const result = formatCurrency(null as any, 'USD');
    expect(toNumber(result)).toBe(0);
  });

  it('should handle very large numbers', () => {
    const result = formatCurrency(1234567890.12, 'USD');
    expect(toNumber(result)).toBeCloseTo(1234567890.12, 2);
  });

  it('should handle very small numbers', () => {
    const result = formatCurrency(0.01, 'USD');
    expect(toNumber(result)).toBeCloseTo(0.01, 2);
  });
});

