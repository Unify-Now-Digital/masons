import React from 'react';

/**
 * Gardens design-system primitives.
 *
 * Small, self-contained components that mirror the Mason design prototype
 * (/tmp/design/mason-app/project/src/primitives.jsx). Implemented as plain
 * React + Tailwind + inline styles so they can be dropped into any page
 * without adding runtime dependencies.
 */

export type PillTone = 'neutral' | 'accent' | 'green' | 'red' | 'amber' | 'blue' | 'ai';

const PILL_TONES: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: '#F0ECE2', fg: 'var(--g-txs)', dot: 'var(--g-txm)' },
  accent:  { bg: 'var(--g-acc-lt)', fg: 'var(--g-acc-dk)', dot: 'var(--g-acc)' },
  green:   { bg: 'var(--g-grn-lt)', fg: 'var(--g-grn-dk)', dot: 'var(--g-grn)' },
  red:     { bg: 'var(--g-red-lt)', fg: '#8B2020', dot: 'var(--g-red)' },
  amber:   { bg: 'var(--g-amb-lt)', fg: 'var(--g-amb-dk)', dot: 'var(--g-amb)' },
  blue:    { bg: 'var(--g-blu-lt)', fg: 'var(--g-blu-dk)', dot: 'var(--g-blu)' },
  ai:      { bg: 'rgba(194,105,59,0.08)', fg: 'var(--g-acc-dk)', dot: 'var(--g-acc)' },
};

export interface PillProps {
  tone?: PillTone;
  dot?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Pill: React.FC<PillProps> = ({ tone = 'neutral', dot = false, children, style }) => {
  const t = PILL_TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-[5px] text-[11px] font-semibold px-2 py-[2px] rounded-[10px] leading-[1.5] whitespace-nowrap"
      style={{ background: t.bg, color: t.fg, ...style }}
    >
      {dot && <span className="w-[6px] h-[6px] rounded-full" style={{ background: t.dot }} />}
      {children}
    </span>
  );
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ padded = true, style, className = '', children, ...rest }, ref) => (
    <div
      ref={ref}
      className={className}
      style={{
        background: 'var(--g-surf)',
        border: '1px solid var(--g-bdr)',
        borderRadius: 10,
        padding: padded ? 18 : 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'dark' | 'danger';
export type BtnSize = 'sm' | 'md' | 'lg';

export interface BtnProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const BTN_SIZES: Record<BtnSize, { px: number; h: number; fs: number; gap: number }> = {
  sm: { px: 10, h: 28, fs: 12, gap: 6 },
  md: { px: 12, h: 32, fs: 13, gap: 7 },
  lg: { px: 16, h: 38, fs: 13, gap: 8 },
};

const BTN_VARIANTS: Record<BtnVariant, React.CSSProperties> = {
  primary: { background: 'var(--g-acc)', color: '#fff' },
  ai: { background: 'var(--g-acc)', color: '#fff' },
  secondary: { background: 'var(--g-surf)', color: 'var(--g-tx)', borderColor: 'var(--g-bdr)' },
  ghost: { background: 'transparent', color: 'var(--g-txs)' },
  dark: { background: 'var(--g-sidebar)', color: '#F0ECE2' },
  danger: { background: 'transparent', color: 'var(--g-red-dk)', borderColor: 'var(--g-bdr)' },
};

export const Btn: React.FC<BtnProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  style,
  disabled,
  ...rest
}) => {
  const s = BTN_SIZES[size];
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    height: s.h,
    padding: `0 ${s.px}px`,
    fontSize: s.fs,
    fontWeight: 600,
    borderRadius: 7,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    transition: 'background .12s, border-color .12s, color .12s',
    fontFamily: 'var(--g-ff-body)',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1,
  };
  return (
    <button
      disabled={disabled}
      style={{ ...base, ...BTN_VARIANTS[variant], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget;
        if (variant === 'primary' || variant === 'ai') el.style.background = 'var(--g-acc-dk)';
        else if (variant === 'secondary') el.style.background = 'var(--g-page)';
        else if (variant === 'ghost') el.style.background = 'var(--g-page)';
        else if (variant === 'danger') el.style.background = 'var(--g-red-lt)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        if (variant === 'primary' || variant === 'ai') el.style.background = 'var(--g-acc)';
        else if (variant === 'secondary') el.style.background = 'var(--g-surf)';
        else if (variant === 'ghost') el.style.background = 'transparent';
        else if (variant === 'danger') el.style.background = 'transparent';
      }}
      {...rest}
    >
      {icon && <span className="inline-flex">{icon}</span>}
      {children}
    </button>
  );
};

export interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  color?: string;
}

const ICON_PATHS: Record<string, React.ReactNode> = {
  check: <polyline points="3,8.5 6.5,12 13,5" />,
  x: (<><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></>),
  sparkle: <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" />,
  mail: (<><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><polyline points="2,3.5 8,9 14,3.5" /></>),
  search: (<><circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></>),
  clock: (<><circle cx="8" cy="8" r="6" /><polyline points="8,4.5 8,8 10.5,9.5" /></>),
  alert: (<><path d="M8 1.5L15 13.5H1L8 1.5z" /><line x1="8" y1="6.5" x2="8" y2="9.5" /><line x1="8" y1="11.5" x2="8" y2="11.6" /></>),
  chevRight: <polyline points="6,3 11,8 6,13" />,
  chevDown: <polyline points="3,6 8,11 13,6" />,
  arrowRight: (<><line x1="3" y1="8" x2="13" y2="8" /><polyline points="9,4 13,8 9,12" /></>),
  plus: (<><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></>),
  doc: (<><path d="M4 2h5l3 3v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" /><polyline points="9,2 9,5 12,5" /></>),
  stamp: (<><circle cx="8" cy="7" r="3.5" /><line x1="4" y1="14" x2="12" y2="14" /><line x1="8" y1="10.5" x2="8" y2="14" /></>),
  inscription: (<><path d="M3 13.5L6.5 2h3L13 13.5" /><line x1="4.5" y1="9.5" x2="11.5" y2="9.5" /></>),
  stone: (<><path d="M4 14V5a4 4 0 0 1 8 0v9" /><line x1="3" y1="14" x2="13" y2="14" /></>),
  sum: (<><path d="M3 13l5-5-5-5h10" /><line x1="3" y1="13" x2="13" y2="13" /></>),
  coins: (<><ellipse cx="8" cy="5" rx="5" ry="2" /><path d="M3 5v3c0 1.1 2.2 2 5 2s5-.9 5-2V5" /><path d="M3 8v3c0 1.1 2.2 2 5 2s5-.9 5-2V8" /></>),
  home: <path d="M2 8l6-5 6 5v5a1 1 0 0 1-1 1h-3v-4H6v4H3a1 1 0 0 1-1-1V8z" />,
  flame: <path d="M8 1.5s1.2 2.5 1.2 4.5c0 1.3-.7 2-.7 2s2-0.5 2-2.5c0 0 2 1.5 2 4.5 0 2.5-2 4.5-4.5 4.5S3.5 13 3.5 10.5C3.5 8 5 6 5 6s.5 1 1.5 1C6.5 6 5 4 5 4s1.5-.5 3-2.5z" />,
  pin: (<><path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5z" /><circle cx="8" cy="6" r="1.5" /></>),
};

export const Icon: React.FC<IconProps> = ({ name, size = 14, stroke = 1.5, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke={color || 'currentColor'}
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {ICON_PATHS[name] ?? null}
  </svg>
);

export interface AIBadgeProps {
  label?: string;
  confidence?: number;
  size?: 'sm' | 'md';
  variant?: 'solid' | 'ghost';
}

export const AIBadge: React.FC<AIBadgeProps> = ({
  label = 'AI',
  confidence,
  size = 'md',
  variant = 'solid',
}) => {
  const sz = size === 'sm' ? { h: 18, px: 6, fs: 10 } : { h: 22, px: 8, fs: 11 };
  const skin: React.CSSProperties =
    variant === 'ghost'
      ? { background: 'rgba(194,105,59,0.1)', color: 'var(--g-acc-dk)', border: '1px solid rgba(194,105,59,0.25)' }
      : { background: 'var(--g-acc)', color: '#fff' };
  return (
    <span
      className="inline-flex items-center gap-[5px] font-bold"
      style={{
        height: sz.h,
        padding: `0 ${sz.px}px`,
        borderRadius: 11,
        fontSize: sz.fs,
        letterSpacing: '0.04em',
        fontFamily: 'var(--g-ff-body)',
        ...skin,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: variant === 'ghost' ? 'var(--g-acc)' : '#fff',
        }}
      />
      {label}
      {confidence != null && (
        <span style={{ opacity: 0.85, fontSize: sz.fs - 1 }}>· {confidence}%</span>
      )}
    </span>
  );
};

export interface AISuggestionProps {
  title: string;
  body?: React.ReactNode;
  confidence?: number;
  actions?: React.ReactNode;
  prominent?: boolean;
  compact?: boolean;
}

export const AISuggestion: React.FC<AISuggestionProps> = ({
  title,
  body,
  confidence,
  actions,
  prominent,
  compact,
}) => (
  <div
    style={{
      position: 'relative',
      borderRadius: 9,
      border: prominent ? '1px solid var(--g-acc)' : '1px solid rgba(194,105,59,0.22)',
      background: prominent ? 'var(--g-acc-lt)' : 'rgba(194,105,59,0.05)',
      padding: compact ? '8px 10px' : '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}
  >
    <div
      style={{
        marginTop: 1,
        flexShrink: 0,
        width: 22,
        height: 22,
        borderRadius: 6,
        background: 'var(--g-acc)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="sparkle" size={11} stroke={2} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 0 : 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--g-acc-dk)' }}>{title}</span>
        {confidence != null && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--g-txs)', fontFamily: 'ui-monospace, monospace' }}>
            {confidence}% confident
          </span>
        )}
      </div>
      {!compact && body && (
        <div style={{ fontSize: 12.5, color: 'var(--g-txs)', lineHeight: 1.5 }}>{body}</div>
      )}
      {actions && (
        <div style={{ marginTop: compact ? 0 : 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  </div>
);

export interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ eyebrow, title, subtitle, right }) => (
  <div className="flex items-end justify-between gap-4 mb-[14px]">
    <div>
      {eyebrow && (
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gardens-txm mb-1.5">
          {eyebrow}
        </div>
      )}
      <h2 className="font-head text-[22px] font-semibold text-gardens-tx tracking-[-0.01em] m-0">
        {title}
      </h2>
      {subtitle && <div className="mt-1 text-gardens-txs text-[13px]">{subtitle}</div>}
    </div>
    {right}
  </div>
);
