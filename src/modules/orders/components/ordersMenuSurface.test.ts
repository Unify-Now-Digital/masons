import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const toolbar = readFileSync(new URL('./OrdersToolbar.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

describe('orders menu surface', () => {
  it('gives both Orders menus a literal opaque plate that the fade cannot override', () => {
    expect(toolbar).toContain("export const ORDERS_POPOVER_CLASS = 'orders-menu-surface");
    expect(toolbar.match(/ORDERS_POPOVER_CLASS/g)?.length).toBeGreaterThanOrEqual(3);
    expect(css).toMatch(/\.orders-menu-surface\s*\{[^}]*background-color:\s*#ffffff\s*!important/s);
    expect(css).toMatch(/\.orders-menu-surface\s*\{[^}]*opacity:\s*1\s*!important/s);
    expect(css).toMatch(/\.orders-menu-surface\s*\{[^}]*animation:\s*none\s*!important/s);
  });
});
