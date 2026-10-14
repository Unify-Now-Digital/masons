import React, { createContext, useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircleReply } from 'lucide-react';
import { PersonOrdersPanel } from '@/modules/inbox/components/PersonOrdersPanel';
import { useOpenOrder } from './OrderPanelContext';

/**
 * Universal side panel for a PERSON (r2, rule #2): clicking a person anywhere (Hub, Pipeline,
 * Finance flow) opens their panel in place — orders, contact, history, New order — reusing the
 * Inbox's PersonOrdersPanel. Leaving the page is only the explicit "Open conversation".
 */
export interface PersonRef { personId: string | null; conversationId?: string | null; name?: string }
const Ctx = createContext<{ openPerson: (p: PersonRef) => void }>({ openPerson: () => {} });
export const useOpenPerson = () => useContext(Ctx).openPerson;

const Host: React.FC<{ p: PersonRef | null; close: () => void }> = ({ p, close }) => {
  const openOrder = useOpenOrder();
  const navigate = useNavigate();
  if (!p) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={close} aria-hidden />
      <aside role="dialog" aria-label={`${p.name ?? 'Person'} panel`} data-testid="person-panel"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-gardens-bdr bg-gardens-surf2 shadow-xl sm:w-[400px]">
        <header className="flex items-center gap-2 border-b border-gardens-bdr px-4 py-3">
          <h2 className="m-0 min-w-0 flex-1 truncate font-head text-[17px] font-semibold text-gardens-tx">{p.name ?? 'Person'}</h2>
          {p.conversationId && (
            <button type="button" onClick={() => { close(); navigate(`/dashboard/inbox?conversation=${p.conversationId}`); }}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-gardens-acc px-3 text-[13px] font-semibold text-white hover:bg-gardens-acc-dk">
              <MessageCircleReply className="h-4 w-4" aria-hidden />Open conversation
            </button>
          )}
          <button type="button" onClick={close} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-gardens-txs hover:bg-gardens-page"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <PersonOrdersPanel personId={p.personId} conversationIds={p.conversationId ? [p.conversationId] : []} selectedJobId={null}
            selectedOrderId={null} onSelectOrder={(id) => { close(); openOrder(id); }} onCloseOrder={() => {}} />
        </div>
      </aside>
    </>
  );
};

export const PersonPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [p, setP] = useState<PersonRef | null>(null);
  const openPerson = useCallback((v: PersonRef) => setP(v), []);
  return (
    <Ctx.Provider value={{ openPerson }}>
      {children}
      <Host p={p} close={() => setP(null)} />
    </Ctx.Provider>
  );
};
