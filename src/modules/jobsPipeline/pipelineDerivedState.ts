import { createContext, useContext } from 'react';
import type { Opportunity } from './utils/opportunities';

export interface DerivedJob {
  stage: 'enquired' | 'quoted' | 'invoiced';
  value: number;
  label: string;
  why: string;
  kind: string;
}

export const PipelineDerivedContext = createContext<Map<string, DerivedJob>>(new Map());

export function derivedJobs(opps: Opportunity[]): Map<string, DerivedJob> {
  const map = new Map<string, DerivedJob>();
  for (const opp of opps) {
    const stage = opp.state.stage === 'quoted'
      ? 'quoted'
      : opp.state.stage === 'invoiced' || opp.state.stage === 'deposit_paid'
        ? 'invoiced'
        : 'enquired';
    map.set(opp.job.id, { stage, value: opp.value, label: opp.action.label, why: opp.action.why, kind: opp.action.kind });
  }
  return map;
}

export function useDerivedMap(): Map<string, DerivedJob> {
  return useContext(PipelineDerivedContext);
}

export function useDerivedJob(id: string): DerivedJob | null {
  return useContext(PipelineDerivedContext).get(id) ?? null;
}
