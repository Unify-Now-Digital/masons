import { describe, expect, it } from 'vitest';
import {
  canBuildInvoices,
  cataloguePriceWrite,
  invoiceDraftTotal,
  isFinanceTarget,
  moneyFigure,
  priceOnProductSelect,
  viewerPrimary,
} from './invoiceBuilderAccess';
import { orderDetailFieldsFromQuote, type QuoteForOrderConversion } from '@/modules/orders/utils/orderFromQuoteConversion';
import { transformProductsFromDb } from '@/modules/products/utils/productTransform';

const quote = (value: number | null, permit: number | null): QuoteForOrderConversion => ({
  id: 'q1',
  customer_id: 'p1',
  deceased_name: 'Ada Stone',
  product_name: 'Ogee',
  product_sku: 'OG-1',
  material: 'Granite',
  color: 'Black',
  inscription: 'Ada',
  value,
  permit_cost: permit,
  total_value: value,
  location: 'Highgate',
  notes: null,
  status: 'accepted',
  converted_to_order_id: null,
  converted_at: null,
});

describe('inbox invoice builder access', () => {
  it('lets the owner build and send invoices, and stops staff', () => {
    expect(canBuildInvoices(true)).toBe(true);
    expect(canBuildInvoices(false)).toBe(false);
  });

  it('copies the catalogue price onto the order for the owner and leaves staff with no price', () => {
    expect(priceOnProductSelect(1850, true)).toBe(1850);
    expect(priceOnProductSelect(1850, false)).toBeNull();
    expect(priceOnProductSelect(null, true)).toBeNull();
    const products = transformProductsFromDb([
      { id: 'prod-1', name: 'Ogee', base_price: 1850, image_url: null, is_active: true, is_featured: false, display_order: 1, created_at: '' },
      { id: 'prod-2', name: 'Hidden', base_price: null, image_url: null, is_active: true, is_featured: false, display_order: null, created_at: '' },
    ]);
    expect(priceOnProductSelect(products[0].price, true)).toBe(1850);
    expect(priceOnProductSelect(products[1].price, false)).toBeNull();
  });

  it('keeps an owner price override and each add-on cost in the invoice total', () => {
    const total = invoiceDraftTotal([
      {
        orderType: 'New Memorial',
        value: 999,
        renovationServiceCost: 50,
        permitCost: 150,
        addOnCosts: [40, null, 25.5],
      },
    ]);
    expect(total).toBe(1214.5);
    expect(JSON.stringify(total)).not.toMatch(/£/);
  });

  it('uses the renovation service cost, not the memorial price, for a renovation line', () => {
    expect(invoiceDraftTotal([
      { orderType: 'Renovation', value: 5000, renovationServiceCost: 320, permitCost: 80, addOnCosts: [15] },
    ])).toBe(415);
  });

  it('writes the catalogue price for the owner and omits it for staff', () => {
    expect(cataloguePriceWrite(true, 640)).toBe(640);
    expect(cataloguePriceWrite(true, 0)).toBe(0);
    expect(cataloguePriceWrite(false, 640)).toBeUndefined();
  });

  it('shows a pound figure only to the owner', () => {
    expect(moneyFigure('£1,200.00', true)).toBe('£1,200.00');
    expect(moneyFigure('£0.00', false)).toBeNull();
    expect(moneyFigure('£0.00', false) ?? '').not.toMatch(/£|\d/);
  });

  it('keeps Reply for staff and drops finance and invoice collect targets', () => {
    expect(viewerPrimary({ label: 'Reply', target: 'composer' }, false)?.target).toBe('composer');
    expect(viewerPrimary({ label: 'Request deposit', target: '/dashboard/finance' }, false)).toBeNull();
    expect(viewerPrimary(
      { label: 'Request deposit', target: '/dashboard/finance?invoice=inv-1&focus=collect&amount=deposit' },
      false,
    )).toBeNull();
    expect(isFinanceTarget('/dashboard/finance?invoice=inv-1&focus=collect&amount=full')).toBe(true);
    expect(viewerPrimary(
      { label: 'Request deposit', target: '/dashboard/finance?invoice=inv-1&focus=collect&amount=deposit' },
      true,
    )?.target).toContain('amount=deposit');
  });

  it('copies quote price and permit onto the order for the owner, and does not invent a price when amounts are absent', () => {
    const owner = orderDetailFieldsFromQuote(quote(2400, 180), 'prod-1');
    expect(owner.value).toBe(2400);
    expect(owner.permit_cost).toBe(180);
    expect(owner.product_id).toBe('prod-1');
    const staff = orderDetailFieldsFromQuote(quote(null, null), null);
    expect(staff.value).toBeNull();
    expect(staff.permit_cost).toBe(0);
  });
});
