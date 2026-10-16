import React from 'react';
import { permitPinStyle, type PermitPinStatus } from '../../utils/permitPins';

/** Compact status glyph. Colour comes from the permit token; the shape is extra. */
export const PermitStatusMark: React.FC<{ status: PermitPinStatus; off?: boolean }> = ({ status, off = false }) => {
  const s = permitPinStyle(status);
  const colour = `var(${s.token}, ${s.colour})`;
  const opacity = off ? 0.4 : 1;

  if (s.shape === 'ring' || s.shape === 'dash') {
    return (
      <span
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 bg-white"
        style={{ borderColor: colour, opacity }}
        aria-hidden
      >
        {s.shape === 'dash' && <span className="h-0.5 w-1.5 rounded-full" style={{ background: colour }} />}
      </span>
    );
  }

  if (s.shape === 'square') {
    return <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-[2px]" style={{ background: colour, opacity }} aria-hidden />;
  }

  if (s.shape === 'diamond') {
    return (
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" style={{ opacity }} aria-hidden>
        <span className="h-2.5 w-2.5 rotate-45 rounded-[1px]" style={{ background: colour }} />
      </span>
    );
  }

  if (s.shape === 'check') {
    return (
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full" style={{ background: colour, opacity }} aria-hidden>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 5.2 4 7.2 8 3" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: colour, opacity }} aria-hidden />;
};
