import { describe, expect, it } from 'vitest';
import { orderFormSchema } from './order.schema';

/** Minimal record that satisfies the schema; every other field is optional or defaulted. */
const valid = {
  customer_name: 'Deceased',
  order_type: 'New Memorial' as const,
  sku: 'G-1',
  location: 'Cemetery',
};

const issuePaths = (result: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => i.path.join('.'));

describe('orderFormSchema', () => {
  it('accepts a complete record', () => {
    expect(orderFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts empty Grave Number and Location', () => {
    const result = orderFormSchema.safeParse({ ...valid, sku: '', location: '' });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ sku: '', location: '' });
  });

  it('requires order_type', () => {
    const { order_type: _omit, ...rest } = valid;
    expect(issuePaths(orderFormSchema.safeParse(rest))).toEqual(['order_type']);
  });
});
