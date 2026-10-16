import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileText } from 'lucide-react';
import { InfoList, PanelSection, SidePanel } from './index';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('shared side panel', () => {
  it('draws the overlay rail at 420px with the serif header and close control', () => {
    const out = html(
      <SidePanel mode="overlay" label="Enquiry panel" name="Margaret Hale" kicker="Enquiry" onClose={() => {}} action={<button type="button">New order</button>}>
        <p>Body</p>
      </SidePanel>,
    );
    expect(out).toContain('lg:w-[420px]');
    expect(out).toContain('bg-gardens-surf2');
    expect(out).toContain('border-l');
    expect(out).toContain('font-head');
    expect(out).toContain('Margaret Hale');
    expect(out).toContain('Enquiry');
    expect(out).toContain('New order');
    expect(out).toContain('aria-label="Close"');
  });

  it('docked rail has no close control and no fixed backdrop', () => {
    const out = html(
      <SidePanel mode="dock" label="Today" testId="order-context-panel" name="Dean (no surname)" kicker="Customer">
        <span>Body</span>
      </SidePanel>,
    );
    expect(out).toContain('data-variant="docked"');
    expect(out).not.toContain('aria-label="Close"');
    expect(out).not.toContain('fixed');
    expect(out).not.toContain('inset-0');
  });

  it('section header has an icon, a count and a chevron, and rows put the value on the right', () => {
    const out = html(
      <PanelSection id="enquiry" title="Enquiry" icon={FileText} open aside={2} onToggle={() => {}}>
        <InfoList rows={[{ label: 'Stone', value: 'Grey granite' }]} />
      </PanelSection>,
    );
    expect(out).toContain('data-section="enquiry"');
    expect(out).toContain('aria-expanded="true"');
    expect(out).toContain('>2<');
    expect(out).toContain('text-gardens-txs');
    expect(out).toContain('text-right');
    expect(out).toContain('Grey granite');
  });
});
