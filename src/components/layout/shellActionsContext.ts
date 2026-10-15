import { createContext, useContext } from 'react';

export interface ShellActionsValue {
  openSearch: () => void;
  openAi: () => void;
  aiAvailable: boolean;
  aiLabel: string;
  shortcut: string;
}

export const ShellActionsContext = createContext<ShellActionsValue>({
  openSearch: () => {}, openAi: () => {}, aiAvailable: true, aiLabel: 'Ask AI', shortcut: 'Ctrl K',
});

export const useShellActions = () => useContext(ShellActionsContext);
