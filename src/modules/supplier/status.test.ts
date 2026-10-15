import { describe, expect, it } from 'vitest';
import {
  groupJobs,
  parseBoardItems,
  parseDelivery,
  parseReference,
  planLinks,
  rollupForOrder,
  type JobForRollup,
  type LinkForRollup,
  type MasonOrderRef,
} from '../../../supabase/functions/_shared/supplierStatus';

const lindsey: MasonOrderRef = {
  id: 'order-233',
  orderNumber: 233,
  customerName: 'Noella Lindsey',
  personName: 'Noella Lindsey',
  productName: 'Dartmoor',
};
const henry: MasonOrderRef = {
  id: 'order-201',
  orderNumber: 201,
  customerName: 'John Henry',
  personName: 'Ann Henry',
  productName: 'Hambleton',
};
const henryOther: MasonOrderRef = {
  id: 'order-274',
  orderNumber: 274,
  customerName: 'Henry Obuabang',
  personName: 'Henry Obuabang',
  productName: 'Ogee',
};
const barnett: MasonOrderRef = {
  id: 'order-179',
  orderNumber: 179,
  customerName: 'Robert Barnett',
  personName: 'Jane Barnett',
  productName: 'Knole',
};

describe('supplier reference matching', () => {
  it('reads an order number, surname and SM tag', () => {
    expect(parseReference('233 LINDSEY SM')).toMatchObject({
      orderNumber: 233,
      hasSm: true,
      surname: 'LINDSEY',
    });
  });

  it('auto-links only order number + surname + SM', () => {
    const links = planLinks('233 LINDSEY SM', [lindsey, henry]);
    expect(links).toEqual([
      { orderId: 'order-233', confidence: 'high', rule: 'order+surname+sm', linkStatus: 'auto' },
    ]);
  });

  it('does not auto-link a shared surname on a different order number', () => {
    const links = planLinks('201 HENRY SM', [henry, henryOther]);
    expect(links.map((link) => link.orderId)).toEqual(['order-201']);
    expect(links[0].linkStatus).toBe('auto');
    expect(links.some((link) => link.orderId === 'order-274')).toBe(false);
  });

  it('queues a product and first-name match instead of linking it', () => {
    const links = planLinks('KNOLE ROB SM', [barnett]);
    expect(links).toEqual([
      { orderId: 'order-179', confidence: 'medium', rule: 'product+first+sm', linkStatus: 'suggested' },
    ]);
  });

  it('ignores a reference with no order number and no SM tag', () => {
    expect(planLinks('GR012 Patricia', [barnett, lindsey])).toEqual([]);
  });
});

describe('supplier delivery dates', () => {
  it('accepts a real date and refuses a docking estimate', () => {
    expect(parseDelivery('15/11/2026')).toEqual({ date: '2026-11-15', estimate: null });
    expect(parseDelivery('2026-11-02')).toEqual({ date: '2026-11-02', estimate: null });
    expect(parseDelivery('Roughly Docking 2nd Week Of November').date).toBeNull();
    expect(parseDelivery('').date).toBeNull();
  });
});

describe('supplier rollup', () => {
  const job: JobForRollup = {
    id: 'job-1',
    jobCode: 'M242R1101',
    customerReference: '233 LINDSEY SM',
    batchCode: 'MPL242',
    containerCode: 'HASU1349483',
    normalizedStatus: 'transit',
    deliveryDate: '2026-11-15',
    deliveryEstimate: null,
    syncedAt: '2026-10-15T22:10:00Z',
    stale: false,
    parts: [
      { description: 'Ogee top', normalizedStatus: 'transit' },
      { description: 'Cover slab', normalizedStatus: 'transit' },
      { description: 'Side kerbs', normalizedStatus: 'production' },
    ],
  };

  it('uses the most advanced part and counts the others', () => {
    const links: LinkForRollup[] = [
      { id: 'l1', orderId: 'order-233', jobId: 'job-1', confidence: 'high', rule: 'order+surname+sm', linkStatus: 'auto' },
    ];
    const rollup = rollupForOrder('order-233', links, [job]);
    expect(rollup.kind).toBe('linked');
    expect(rollup.statusLabel).toBe('In transit');
    expect(rollup.otherParts).toBe(2);
    expect(rollup.deliveryDate).toBe('2026-11-15');
    expect(rollup.parts.find((part) => part.drives)?.description).toBe('Ogee top');
  });

  it('prefers arrived over in transit', () => {
    const arrived = {
      ...job,
      id: 'job-2',
      parts: [{ description: 'Headstone', normalizedStatus: 'arrived' as const }],
      deliveryDate: '2026-11-20',
    };
    const rollup = rollupForOrder('order-233', [
      { id: 'a', orderId: 'order-233', jobId: 'job-1', confidence: 'high', rule: 'order+surname+sm', linkStatus: 'auto' },
      { id: 'b', orderId: 'order-233', jobId: 'job-2', confidence: 'high', rule: 'order+surname+sm', linkStatus: 'confirmed' },
    ], [job, arrived]);
    expect(rollup.statusLabel).toBe('Arrived');
    expect(rollup.deliveryDate).toBe('2026-11-15');
    expect(rollup.otherParts).toBe(3);
  });

  it('labels a suggested match for staff to confirm', () => {
    const rollup = rollupForOrder('order-233', [
      { id: 's', orderId: 'order-233', jobId: 'job-1', confidence: 'medium', rule: 'order+sm', linkStatus: 'suggested' },
    ], [job]);
    expect(rollup.kind).toBe('suggested');
    expect(rollup.statusLabel).toBe('Possible match · confirm?');
  });

  it('says an order is not on the board when nothing is linked', () => {
    expect(rollupForOrder('order-233', [], [job]).statusLabel).toBe('Not on supplier board');
    expect(rollupForOrder('order-233', [], [job]).kind).toBe('none');
  });

  it('groups Monday rows that share a job code and reads DELIVERY SCH', () => {
    const drafts = groupJobs(parseBoardItems([
      {
        id: '10',
        name: 'Ogee top',
        job_code: 'M245R0601',
        status: 'In Transit',
        batch: 'MPL241',
        reference: '218 OSEJINDU SM',
        column_values: [{ column: { title: 'DELIVERY SCH' }, text: '02/11/2026' }],
      },
      {
        id: '11',
        name: 'Base',
        job_code: 'M245R0601',
        status: 'In Production',
        reference: '218 OSEJINDU SM',
      },
      {
        id: '12',
        name: 'Kerbs',
        status: 'In Production',
        reference: 'CHURCHILL ONLY',
      },
    ]));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].jobCode).toBe('M245R0601');
    expect(drafts[0].parts).toHaveLength(2);
    expect(drafts[0].deliveryDate).toBe('2026-11-02');
    expect(drafts[0].normalizedStatus).toBe('transit');
  });

  it('reads the part name from the description column and the batch from the group', () => {
    const drafts = groupJobs(parseBoardItems([
      {
        id: '20',
        name: 'M242R1101',
        group: { title: 'MPL242 - In Transit - HASU1349483 - Roughly Docking 2nd Week' },
        column_values: [
          { id: 'description', column: { title: 'Description' }, text: 'Headstone' },
          { column: { title: 'Status' }, text: 'In Transit' },
          { column: { title: 'Customer Reference' }, text: '233 LINDSEY SM' },
        ],
      },
      {
        id: '21',
        name: 'M242R1101',
        group: { title: 'MPL242 - In Transit - HASU1349483 - Roughly Docking 2nd Week' },
        column_values: [
          { id: 'description', column: { title: 'Description' }, text: 'Base' },
          { column: { title: 'Status' }, text: 'In Production' },
          { column: { title: 'Customer Reference' }, text: '233 LINDSEY SM' },
        ],
      },
      {
        id: '22',
        name: 'M242R1101',
        parent_id: '20',
        column_values: [
          { id: 'description', column: { title: 'Description' }, text: 'Kerbs' },
          { column: { title: 'Customer Reference' }, text: '233 LINDSEY SM' },
        ],
      },
    ]));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].parts.map((part) => part.description)).toEqual(['Headstone', 'Base', 'Kerbs']);
    expect(drafts[0].batchCode).toBe('MPL242');
    expect(drafts[0].deliveryDate).toBeNull();
    expect(drafts[0].deliveryEstimate).toBe('Roughly Docking 2nd Week');
    expect(drafts[0].parts.some((part) => part.description === 'M242R1101')).toBe(false);
  });
});
