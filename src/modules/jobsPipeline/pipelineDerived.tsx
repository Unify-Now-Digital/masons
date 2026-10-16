import type { ReactNode } from 'react';
import type { Opportunity } from './utils/opportunities';
import { derivedJobs, PipelineDerivedContext } from './pipelineDerivedState';

/** The shared job state, keyed by job, so the board uses the same stage and total as Today. */
export function PipelineDerivedProvider({ opps, children }: { opps: Opportunity[]; children: ReactNode }) {
  return <PipelineDerivedContext.Provider value={derivedJobs(opps)}>{children}</PipelineDerivedContext.Provider>;
}
