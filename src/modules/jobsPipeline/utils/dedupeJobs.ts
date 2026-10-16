/** Same person, same stage, no own enquiry: keep the newest (QA 2026-10-14). */
export function dedupeBareJobs<T extends { person_id: string | null; enquiry_id: string | null; created_at: string }>(jobs: T[]): T[] {
  const newest = new Map<string, T>();
  const out: T[] = [];
  for (const j of jobs) {
    if (!j.person_id || j.enquiry_id) {
      out.push(j);
      continue;
    }
    const prev = newest.get(j.person_id);
    if (!prev || j.created_at > prev.created_at) newest.set(j.person_id, j);
  }
  const keep = new Set(newest.values());
  return jobs.filter((j) => out.includes(j) || keep.has(j));
}
