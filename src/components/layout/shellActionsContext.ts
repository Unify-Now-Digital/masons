import { createContext, useContext } from 'react';

export interface ShellActionsValue {
  openSearch: () => void;
  openAi: () => void;
  openActivity: () => void;
  activityUnread: number;
  aiAvailable: boolean;
  aiLabel: string;
  shortcut: string;
}

export const ShellActionsContext = createContext<ShellActionsValue>({
  openSearch: () => {},
  openAi: () => {},
  openActivity: () => {},
  activityUnread: 0,
  aiAvailable: true,
  aiLabel: 'Ask AI',
  shortcut: 'Ctrl K',
});

export const useShellActions = () => useContext(ShellActionsContext);
