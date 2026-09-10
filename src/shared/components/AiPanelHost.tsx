import { Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet';
import { useAiPanelRegistration } from '@/shared/context/aiPanel';

/**
 * Floating AI button + slide-over, mounted once by PageShell (FR-010/FR-011).
 * Page-agnostic: it renders whatever node the mounted page registered and never
 * imports a feature module (AC-002). The host owns the title and nothing else
 * about the panel's content — any subtitle or framing belongs to the panel.
 */
export function AiPanelHost() {
  // `panel` is read from the context ref during this render. It must never be
  // cached in state or a memo here, or it would freeze at whichever node was
  // registered on the first paint.
  const { registration, panel, open, setOpen } = useAiPanelRegistration();

  // No registration on this route: render nothing at all — no placeholder, no
  // disabled button (FR-012, F-031 class).
  if (!registration) return null;

  const { title, count } = registration;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={title}
        // z-40 keeps the button below the z-50 dialog/sheet layer
        // (ui/dialog.tsx:22,:39; ui/sheet.tsx:22,:32).
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-gardens-acc text-white shadow-lg flex items-center justify-center hover:bg-gardens-acc-dk transition-colors"
      >
        <Sparkles className="w-5 h-5" aria-hidden />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gardens-red text-white text-[10px] font-semibold leading-[18px] text-center border-2 border-gardens-page">
            {count}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        {/* Full width below md. The variant's own `sm:max-w-sm` is overridden at
            the same breakpoint so it cannot clamp the sheet between sm and md.
            aria-describedby={undefined}: the host has no description to give —
            it would have to claim something about a panel it cannot see. */}
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className="w-full sm:max-w-none md:max-w-md p-0 gap-0 flex flex-col bg-gardens-surf"
        >
          <SheetHeader className="px-4 py-3 border-b border-gardens-bdr text-left">
            <SheetTitle className="font-head text-base text-gardens-tx">{title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">{panel}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
