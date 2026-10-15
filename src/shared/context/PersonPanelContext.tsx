import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircleReply } from 'lucide-react';
import { PersonOrdersPanel } from '@/modules/inbox/components/PersonOrdersPanel';
import { PanelShell } from '@/shared/components/mason';
import { useOpenOrder } from './orderPanel';
import { PersonPanelContext, type PersonRef } from './personPanel';

/**
 * Universal side panel for a PERSON. Full-screen sheet below 1024px, right rail from there.
 * The person/order panel draws the one header (name, subtitle, action, close).
 */
const Host: React.FC<{ p: PersonRef | null; close: () => void }> = ({ p, close }) => {
  const openOrder = useOpenOrder();
  const navigate = useNavigate();
  if (!p) return null;
  const openConversation = p.conversationId ? (
    <button
      type="button"
      aria-label="Open conversation"
      onClick={() => { close(); navigate(`/dashboard/inbox?conversation=${p.conversationId}`); }}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-gardens-txs hover:bg-gardens-page"
    >
      <MessageCircleReply className="h-5 w-5" aria-hidden />
    </button>
  ) : null;
  return (
    <PanelShell mode="overlay" label={`${p.name ?? 'Person'} panel`} testId="person-panel">
      <PersonOrdersPanel
        personId={p.personId}
        conversationIds={p.conversationId ? [p.conversationId] : []}
        selectedJobId={null}
        selectedOrderId={null}
        headerActions={openConversation}
        onSelectOrder={(id) => { close(); openOrder(id); }}
        onCloseOrder={close}
      />
    </PanelShell>
  );
};

export const PersonPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [p, setP] = useState<PersonRef | null>(null);
  const openPerson = useCallback((v: PersonRef) => setP(v), []);
  return (
    <PersonPanelContext.Provider value={{ openPerson, isOpen: !!p }}>
      {children}
      <Host p={p} close={() => setP(null)} />
    </PersonPanelContext.Provider>
  );
};
