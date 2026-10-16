/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { dismissGlobalPanels, replaceWith, subscribePanel } from './panelDismiss';

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: () => ({}) } }));
vi.mock('@/modules/orders/hooks/useOrders', () => ({
  useOrder: () => ({ data: null, isError: false, isFetching: false }),
}));
vi.mock('@/modules/inbox/components/PersonOrdersPanel', () => ({
  PersonOrdersPanel: () => <div>person body</div>,
}));

import { OrderPanelProvider } from './OrderPanelContext';
import { PersonPanelProvider } from './PersonPanelContext';
import { useOpenOrder } from './orderPanel';
import { useOpenPerson } from './personPanel';
import { useLocalPanel } from './panelDismiss';

function Go({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)}>{label}</button>;
}

function Pipeline() {
  const openPerson = useOpenPerson();
  return (
    <>
      <button type="button" onClick={() => openPerson({ personId: 'p1', name: 'Gavin Wing' })}>Open person</button>
      <Go to="/dashboard/orders" label="Go orders" />
    </>
  );
}

function Orders() {
  const openOrder = useOpenOrder();
  const [local, setLocal] = useState(false);
  const claim = useLocalPanel(() => setLocal(false));
  return (
    <>
      <button type="button" onClick={() => openOrder('ord-1')}>Open order</button>
      <button type="button" onClick={() => { claim(); setLocal(true); }}>Open local</button>
      {local ? <div data-testid="local-panel">Christine</div> : null}
      <Go to="/dashboard/logistics" label="Go map" />
    </>
  );
}

function Harness({ path }: { path: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <OrderPanelProvider>
        <PersonPanelProvider>
          <Routes>
            <Route path="/dashboard/inquiries" element={<Pipeline />} />
            <Route path="/dashboard/orders" element={<Orders />} />
            <Route path="/dashboard/logistics" element={<div>Map</div>} />
          </Routes>
        </PersonPanelProvider>
      </OrderPanelProvider>
    </MemoryRouter>
  );
}

describe('panelDismiss', () => {
  it('closes the other kinds and leaves the one that is opening', () => {
    const order = vi.fn();
    const person = vi.fn();
    const local = vi.fn();
    const stop = [
      subscribePanel('order', order),
      subscribePanel('person', person),
      subscribePanel('local', local),
    ];
    replaceWith('local');
    expect(order).toHaveBeenCalledOnce();
    expect(person).toHaveBeenCalledOnce();
    expect(local).not.toHaveBeenCalled();
    dismissGlobalPanels();
    expect(local).not.toHaveBeenCalled();
    expect(order).toHaveBeenCalledTimes(2);
    stop.forEach((fn) => fn());
  });
});

describe('side panels', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
  });

  async function renderAt(path: string) {
    await act(async () => { root.render(<Harness path={path} />); });
  }

  it('drops a docked panel when the route changes, then keeps a single panel', async () => {
    await renderAt('/dashboard/inquiries');
    await act(async () => {
      host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="person-panel"]')).not.toBeNull();

    const orders = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Go orders');
    await act(async () => { orders?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.querySelector('[data-testid="person-panel"]')).toBeNull();

    const local = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Open local');
    await act(async () => { local?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.querySelector('[data-testid="local-panel"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="person-panel"]')).toBeNull();
    expect(host.querySelector('[data-testid="order-context-panel"]')).toBeNull();

    const order = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Open order');
    await act(async () => { order?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.querySelector('[data-testid="order-context-panel"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="local-panel"]')).toBeNull();

    const map = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Go map');
    await act(async () => { map?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.textContent).toContain('Map');
    expect(host.querySelector('[data-testid="order-context-panel"]')).toBeNull();
    expect(host.querySelector('[data-testid="person-panel"]')).toBeNull();
  });
});
