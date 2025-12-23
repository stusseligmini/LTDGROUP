export function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  } catch (_error) {
    return `${currency ?? 'USD'} ${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
  }
}

