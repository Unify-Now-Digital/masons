/**
 * Height for the Today prepared-draft box. The textarea grows with its text
 * and only scrolls once it passes the cap. `scrollHeight` is measured with
 * the box collapsed, so a short draft does not keep an inner scrollbar.
 */
export function draftBoxSize(scrollHeight: number, max = 280): { height: number; scroll: boolean } {
  const content = Math.max(0, Math.ceil(Number(scrollHeight) || 0)) + 2;
  if (content <= max) return { height: content, scroll: false };
  return { height: max, scroll: true };
}
