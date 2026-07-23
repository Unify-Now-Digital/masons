const TONE: Record<string, string> = {
    Hot: "bg-red-100 text-red-800",
    Warm: "bg-amber-100 text-amber-800",
    Cool: "bg-slate-100 text-slate-600",
    Converted: "bg-emerald-100 text-emerald-800",
    Priority: "bg-red-100 text-red-800",
    Established: "bg-amber-100 text-amber-800",
    Standard: "bg-slate-100 text-slate-600",
  };
  
  const TONE_OVERRIDE: Record<"customer" | "enquiry", string> = {
    customer: "bg-emerald-100 text-emerald-800",
    enquiry: "bg-slate-100 text-slate-600",
  };

  const COMPONENT_KEYS = [
    "channel", "recency", "message", "appointment", "photos", "cemetery",
    "monetary", "frequency",
  ];

  export function ScoreBadge({
    score,
    band,
    breakdown,
    tone,
  }: {
    score: number;
    band: string;
    breakdown: Record<string, number>;
    tone?: "customer" | "enquiry";
  }) {
    const components = Object.entries(breakdown)
      .filter(([k]) => COMPONENT_KEYS.includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join("  ·  ");
    const title = tone ? [band, components].filter(Boolean).join("  ·  ") : components;
    return (
      <span
        title={title}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          tone ? TONE_OVERRIDE[tone] : TONE[band] ?? TONE.Standard
        }`}
      >
        {tone ? score : <>{band} <span className="opacity-60">{score}</span></>}
      </span>
    );
  }