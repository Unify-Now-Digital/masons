# Contract: Right Detail Sidebar (Order / Invoice / etc.)

## Purpose
Standardize the right-hand detail sidebars (OrderDetailsSidebar, InvoiceDetailSidebar, and any equivalent in People/Workers) for consistent width, behavior, and UX.

## Requirements

1. **Position and width**
   - Fixed on the right: `fixed right-0 top-0 h-full`.
   - Width: single standard (e.g. `w-96` / 384px). All detail sidebars use the same width.
   - z-index above page content (e.g. `z-50`); backdrop below sidebar (e.g. `z-40`).

2. **Backdrop**
   - When sidebar is open, a semi-transparent backdrop covers the main content.
   - Clicking the backdrop closes the sidebar (same as “outside click”).
   - Backdrop must not lock body scroll (no `overflow: hidden` on body).

3. **Header**
   - Sticky at top of sidebar panel: title and close button.
   - Close button clearly visible; same behavior as backdrop click.

4. **Body**
   - Scrollable: `overflow-y-auto` on the scrollable region so long content does not overflow the viewport.
   - No body scroll lock when sidebar is open.

5. **Consistency**
   - Same width, border, shadow, and spacing pattern across Order, Invoice, and any other detail sidebars.
   - Same backdrop and close behavior.

## Current implementation (reference)
- OrderDetailsSidebar: `fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg z-50 overflow-y-auto`.
- InvoiceDetailSidebar: same.
- Both pages use a backdrop `fixed inset-0 z-40 bg-black/10` with `onClick` to close.

## Files affected
- `src/modules/orders/components/OrderDetailsSidebar.tsx`
- `src/modules/invoicing/components/InvoiceDetailSidebar.tsx`
- Any People/Workers detail panel (if present)
- Parent pages that render backdrop + sidebar

## Acceptance
- All detail sidebars use the same width and visual style.
- Backdrop click and close button close the sidebar.
- Sidebar content scrolls internally; page body remains scrollable when sidebar is open.
- No scroll lock or overflow issues after opening/closing.
