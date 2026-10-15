export const money = (n: number | null) => (n == null ? '—' : `£${Math.round(n).toLocaleString('en-GB')}`);
