import { createContext, useContext } from 'react';

export interface PersonRef { personId: string | null; conversationId?: string | null; name?: string }
export const PersonPanelContext = createContext<{ openPerson: (p: PersonRef) => void }>({ openPerson: () => {} });
export const useOpenPerson = () => useContext(PersonPanelContext).openPerson;
