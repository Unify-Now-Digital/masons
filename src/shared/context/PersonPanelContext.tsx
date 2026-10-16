import React, { useCallback, useEffect, useState } from 'react';
import { PersonOrdersPanel } from '@/modules/inbox/components/PersonOrdersPanel';
import { PanelShell } from '@/shared/components/mason';
import { PersonPanelContext, type PersonRef } from './personPanel';
import { replaceWith, subscribePanel } from './panelDismiss';

/**
 * Universal side panel for a PERSON. Full-screen sheet below 1024px, right rail from there.
 * The person panel keeps the selected order inside itself. Closing on the first
 * auto-select used to open the order rail before the order had loaded, so the
 * first click looked blank.
 */
const Host: React.FC<{ p: PersonRef | null; close: () => void }> = ({ p, close }) => {
  const [orderId, setOrderId] = useState<string | null>(null);
  const personKey = p ? `${p.personId ?? ''}:${p.conversationId ?? ''}` : '';
  useEffect(() => {
    setOrderId(null);
  }, [personKey]);
  if (!p) return null;
  return (
    <PanelShell mode="overlay" label={`${p.name ?? 'Person'} panel`} testId="person-panel">
      <PersonOrdersPanel
        personId={p.personId}
        conversationIds={p.conversationId ? [p.conversationId] : []}
        selectedJobId={null}
        selectedOrderId={orderId}
        displayName={p.name}
        onSelectOrder={setOrderId}
        onCloseOrder={close}
      />
    </PanelShell>
  );
};

export const PersonPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [p, setP] = useState<PersonRef | null>(null);
  useEffect(() => subscribePanel('person', () => setP(null)), []);
  const openPerson = useCallback((v: PersonRef) => {
    replaceWith('person');
    setP(v);
  }, []);
  return (
    <PersonPanelContext.Provider value={{ openPerson, isOpen: !!p }}>
      {children}
      <Host p={p} close={() => setP(null)} />
    </PersonPanelContext.Provider>
  );
};
