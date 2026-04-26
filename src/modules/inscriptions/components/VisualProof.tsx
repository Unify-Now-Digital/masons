
import React, { useMemo } from 'react';
import { StoneShape } from '@/shared/types/prototype.types';

interface VisualProofProps {
  id?: string;
  shape: StoneShape;
  lines: { text: string; y: number; fontSize: number }[];
  width?: number;
  height?: number;
  materialColor?: string;
  letteringColor?: string;
  hideOverlay?: boolean;
}

// ── Shape-aware inscribable region ──────────────────────────────────

interface TextRegion {
  safeTop: number;
  safeBottom: number;
  centerX: number;
  getWidthAt: (y: number) => number;
}

function getTextRegion(shape: StoneShape): TextRegion {
  switch (shape) {
    case 'ogee':
      return {
        safeTop: 110,
        safeBottom: 355,
        centerX: 200,
        getWidthAt: (y) => {
          if (y >= 130) return 290;
          const t = Math.max(0, (y - 65) / 65);
          return 130 + t * 160;
        },
      };

    case 'half-round':
      return {
        safeTop: 85,
        safeBottom: 355,
        centerX: 200,
        getWidthAt: (y) => {
          if (y >= 195) return 290;
          const r = 170;
          const dy = 195 - y;
          if (dy >= r) return 50;
          return Math.min(2 * Math.sqrt(r * r - dy * dy) - 70, 290);
        },
      };

    case 'heart':
      return {
        safeTop: 200,
        safeBottom: 345,
        centerX: 200,
        getWidthAt: (y) => {
          if (y < 195) return 100;
          if (y > 360) return 30;
          const peak = 240;
          const dist = Math.abs(y - peak);
          return Math.max(220 - dist * 2.2, 50);
        },
      };

    case 'kerb-set':
      return {
        safeTop: 75,
        safeBottom: 325,
        centerX: 200,
        getWidthAt: () => 145,
      };

    case 'square':
    default:
      return {
        safeTop: 50,
        safeBottom: 355,
        centerX: 200,
        getWidthAt: () => 290,
      };
  }
}

// ── Auto-layout lines within the inscribable region ────────────────

const CHAR_WIDTH_RATIO = 0.62;

interface ComputedLine {
  text: string;
  y: number;
  fontSize: number;
}

function computeLayout(
  lines: { text: string; y: number; fontSize: number }[],
  shape: StoneShape
): ComputedLine[] {
  if (lines.length === 0) return [];

  const region = getTextRegion(shape);
  const totalHeight = region.safeBottom - region.safeTop;
  const lineSpacing = totalHeight / (lines.length + 1);

  return lines.map((line, i) => {
    const y = region.safeTop + lineSpacing * (i + 1);
    const availableWidth = region.getWidthAt(y);
    const textLen = line.text.length || 1;

    const maxFontForWidth = availableWidth / (textLen * CHAR_WIDTH_RATIO);
    const fontSize = Math.max(Math.min(line.fontSize, maxFontForWidth, 28), 8);

    return {
      text: line.text,
      y: Math.round(y),
      fontSize: Math.round(fontSize),
    };
  });
}

// ── Component ──────────────────────────────────────────────────────

const VisualProof: React.FC<VisualProofProps> = ({
  id = "vector-proof-svg",
  shape,
  lines,
  width = 320,
  height = 400,
  materialColor = "#262626",
  letteringColor = "#e2b13c",
  hideOverlay = false
}) => {

  const getShapePath = () => {
    const w = 400;
    const margin = 20;

    switch (shape) {
      case 'ogee':
        return `M ${margin} 380 L ${margin} 120 C ${margin} 80, 100 80, 120 60 C 160 30, 240 30, 280 60 C 300 80, ${w-margin} 80, ${w-margin} 120 L ${w-margin} 380 Z`;
      case 'half-round':
        return `M ${margin} 380 L ${margin} 180 A 180 180 0 0 1 ${w-margin} 180 L ${w-margin} 380 Z`;
      case 'heart':
        return `M 200 380 C 100 350, ${margin} 280, ${margin} 180 A 85 85 0 0 1 200 180 A 85 85 0 0 1 ${w-margin} 180 C ${w-margin} 280, 300 350, 200 380 Z`;
      case 'kerb-set':
        return `M 100 350 L 100 80 C 100 60, 140 40, 200 40 C 260 40, 300 60, 300 80 L 300 350 Z`;
      case 'square':
      default:
        return `M ${margin} 380 L ${margin} ${margin} L ${w-margin} ${margin} L ${w-margin} 380 Z`;
    }
  };

  const shapePath = getShapePath();
  const region = getTextRegion(shape);
  const computedLines = useMemo(() => computeLayout(lines, shape), [lines, shape]);

  return (
    <div className={`relative inline-block bg-gardens-bdr/50 p-6 rounded-[2.5rem] border border-gardens-bdr shadow-inner overflow-hidden flex items-center justify-center`}>
      <svg
        id={id}
        width={width}
        height={height}
        viewBox="0 0 400 500"
        className="drop-shadow-2xl overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="stoneGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'white', stopOpacity: 0.2 }} />
            <stop offset="50%" style={{ stopColor: 'white', stopOpacity: 0 }} />
            <stop offset="100%" style={{ stopColor: 'black', stopOpacity: 0.4 }} />
          </linearGradient>
          {/* Clip inscription text to the stone shape */}
          <clipPath id={`${id}-stone-clip`}>
            <path d={shapePath} />
          </clipPath>
        </defs>

        {/* Stone shadow */}
        {!hideOverlay && <path d={shapePath} fill="rgba(0,0,0,0.15)" transform="translate(8, 8)" />}

        {/* Kerb Surround */}
        {shape === 'kerb-set' && (
          <g id="kerbs">
            <rect x="50" y="340" width="300" height="40" fill={materialColor} stroke="#000" strokeWidth="1" />
            <path d="M 50 380 L 10 480 L 60 480 L 90 380 Z" fill={materialColor} stroke="#000" strokeWidth="1" />
            <path d="M 350 380 L 390 480 L 340 480 L 310 380 Z" fill={materialColor} stroke="#000" strokeWidth="1" />
            <rect x="50" y="460" width="300" height="20" fill={materialColor} stroke="#000" strokeWidth="1" />
            <rect x="90" y="380" width="220" height="80" fill="#e5e7eb" opacity="0.6" />
          </g>
        )}

        {/* Stone Body */}
        <path id="stone-outline" d={shapePath} fill={materialColor} stroke="#000" strokeWidth="1" />

        {/* Polish Gradient */}
        {!hideOverlay && <path d={shapePath} fill="url(#stoneGradient)" opacity="0.3" />}

        {/* Lettering Group - clipped to stone and auto-positioned */}
        <g
          id="inscription-group"
          clipPath={`url(#${id}-stone-clip)`}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: "serif", fontWeight: 700 }}
        >
          {computedLines.map((line, idx) => (
            <text
              key={idx}
              x={region.centerX}
              y={line.y}
              fontSize={line.fontSize}
              fill={letteringColor}
              className="tracking-wider select-none pointer-events-none"
              style={{ filter: hideOverlay ? 'none' : 'drop-shadow(0px 1px 1px rgba(0,0,0,0.6))' }}
            >
              {line.text.toUpperCase()}
            </text>
          ))}
        </g>
      </svg>

      {!hideOverlay && (
        <div className="absolute top-3 left-3 flex gap-2">
           <div className="px-2 py-0.5 bg-white/90 backdrop-blur rounded-full text-[7px] font-black uppercase tracking-widest text-gardens-txs border border-gardens-bdr">
             {shape} Preview
           </div>
        </div>
      )}
    </div>
  );
};

export default VisualProof;
