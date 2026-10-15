import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircleReply } from 'lucide-react';
import { PersonOrdersPanel } from '@/modules/inbox/components/PersonOrdersPanel';
import { PanelHeader, PanelShell } from '@/shared/components/mason';
import { useOpenOrder } from './orderPanel';
import { PersonPanelContext, type PersonRef } from './personPanel';

/**
 * Universal side panel for a PERSON. Docked on the right from 1024px (the page
 * keeps a matching margin). Full-screen sheet below that. Same header as the order panel.
 */
const Host: React.FC<{ p: PersonRef | null; close: () => void }> = ({ p, close }) => {
  const openOrder = useOpenOrder();
  const navigate = useNavigate();
  if (!p) return null;
  return (
    <PanelShell mode="overlay" label={`${p.name ?? 'Person'} panel`} testId="person-panel">
      <PanelHeader name={p.name ?? 'Person'} onClose={close} />
      {p.conversationId ? (
        <div className="px-6 pt-3">
          <button
            type="button"
            onClick={() => { close(); navigate(`/dashboard/inbox?conversation=${p.conversationId}`); }}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gardens-bdr bg-white px-3.5 text-[13px] font-semibold text-gardens-tx hover:bg-gardens-page"
          >
            <MessageCircleReply className="h-4 w-4" aria-hidden />
            Open conversation
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <PersonOrdersPanel
          personId={p.personId}
          conversationIds={p.conversationId ? [p.conversationId] : []}
          selectedJobId={null}
          selectedOrderId={null}
          hideClose
          onSelectOrder={(id) => { close(); openOrder(id); }}
          onCloseOrder={() => {}}
        />
      </div>
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
