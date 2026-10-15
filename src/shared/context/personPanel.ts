import { createContext, useContext } from 'react';

export interface PersonRef { personId: string | null; conversationId?: string | null; name?: string }
export const PersonPanelContext = createContext<{ openPerson: (p: PersonRef) => void; isOpen: boolean }>({ openPerson: () => {}, isOpen: false });
export const useOpenPerson = () => useContext(PersonPanelContext).openPerson;
export const usePersonPanelOpen = () => useContext(PersonPanelContext).isOpen;
