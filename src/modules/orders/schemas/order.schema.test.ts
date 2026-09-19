import { describe, expect, it } from 'vitest';
import { orderFormSchema, orderFormSideSchema } from './order.schema';

/** Minimal record that satisfies the base schema; every other field is optional or defaulted. */
const valid = {
  customer_name: 'Deceased',
  order_type: 'New Memorial' as const,
  sku: 'G-1',
  location: 'Cemetery',
};

const issuePaths = (result: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => i.path.join('.'));

describe('orderFormSchema (modal)', () => {
  it('accepts a complete record', () => {
    expect(orderFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty Grave Number', () => {
    expect(issuePaths(orderFormSchema.safeParse({ ...valid, sku: '' }))).toEqual(['sku']);
  });

  it('rejects an empty Location', () => {
    expect(issuePaths(orderFormSchema.safeParse({ ...valid, location: '' }))).toEqual(['location']);
  });

  it('requires order_type', () => {
    const { order_type: _omit, ...rest } = valid;
    expect(issuePaths(orderFormSchema.safeParse(rest))).toEqual(['order_type']);
  });
});

describe('orderFormSideSchema (side)', () => {
  it('accepts empty Grave Number and Location', () => {
    const result = orderFormSideSchema.safeParse({ ...valid, sku: '', location: '' });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ sku: '', location: '' });
  });

  it('requires order_type', () => {
    const { order_type: _omit, ...rest } = valid;
    expect(issuePaths(orderFormSideSchema.safeParse(rest))).toEqual(['order_type']);
  });
});
