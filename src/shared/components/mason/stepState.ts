export type StepState = 'done' | 'progress' | 'blocked' | 'todo' | 'unknown';

/** The SYMBOL carries the state (audit #2, WCAG 1.4.1); colour only reinforces. */
export const STEP_SYMBOL: Record<StepState, string> = {
  done: '✓',
  progress: '◐',
  blocked: '!',
  todo: '○',
  unknown: '?',
};

export const STEP_WORD: Record<StepState, string> = {
  done: 'done',
  progress: 'in progress',
  blocked: 'blocked on us',
  todo: 'not started',
  unknown: 'unknown',
};


/** Order progress → node state, from existing status fields (unknown when the value is missing). */
export function stoneStep(v?: string | null): StepState {
  if (v === 'In Stock') return 'done';
  if (v === 'Ordered') return 'progress';
  if (v === 'NA') return 'todo';
  return 'unknown';
}
export function permitStep(v?: string | null, depositPaid = true): StepState {
  switch (v) {
    case 'approved': return 'done';
    case 'form_sent': case 'pending': return 'progress';
    case 'customer_completed': return 'blocked';
    case 'not_started': return depositPaid ? 'blocked' : 'todo';
    default: return 'unknown';
  }
}
export function proofStep(v?: string | null): StepState {
  switch (v) {
    case 'Approved': case 'Lettered': return 'done';
    case 'Sent': case 'In_Progress': return 'progress';
    case 'Received': case 'Revision': return 'blocked';
    case 'Not_Received': case 'NA': return 'todo';
    default: return 'unknown';
  }
}
