import { BellRing, FilePlus2, Image, MessageCircleReply, PoundSterling, Receipt, Scale, Wrench, type LucideIcon } from 'lucide-react';
import { VERB_ICON } from '@/shared/work/verbs';
import type { Verb } from '@/shared/work/types';

/** Lucide components for verbs.ts's VERB_ICON names (explicit map keeps lucide tree-shaken). */
const BY_NAME: Record<string, LucideIcon> = { BellRing, FilePlus2, Image, MessageCircleReply, PoundSterling, Receipt, Scale, Wrench };

export const verbIcon = (verb: Verb): LucideIcon => BY_NAME[VERB_ICON[verb]] ?? BellRing;
