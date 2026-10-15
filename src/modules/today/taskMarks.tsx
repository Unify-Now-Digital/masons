import { Banknote, ClipboardList, MessageSquare, PenLine, ScrollText, User, UserCheck } from 'lucide-react';
import React from 'react';
import type { TaskMark } from './personRows';

const TASK_ICON = {
  message: MessageSquare,
  order: ClipboardList,
  proof: PenLine,
  permit: ScrollText,
  payment: Banknote,
} as const;

export const RelationIcon: React.FC<{ customer: boolean; className?: string }> = ({ customer, className }) => {
  const Icon = customer ? UserCheck : User;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
};

export const TaskMarkIcon: React.FC<{ mark: TaskMark; className?: string }> = ({ mark, className }) => {
  const Icon = TASK_ICON[mark];
  return <Icon className={className} strokeWidth={2} aria-hidden />;
};
