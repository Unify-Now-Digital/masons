import { describe, expect, it } from 'vitest';
import { attachmentsFromMeta, rewriteCidImages } from './cidImages';

describe('cid image rewrite', () => {
  it('rewrites a cid image when the attachment URL is known', () => {
    const html = '<img src="cid:logo@mail" alt="Logo">';
    const out = rewriteCidImages(html, [{ contentId: '<logo@mail>', url: 'https://cdn.example/logo.png' }]);
    expect(out).toContain('src="https://cdn.example/logo.png"');
    expect(out).not.toMatch(/cid:/i);
  });

  it('hides a cid image that has no attachment URL', () => {
    const out = rewriteCidImages('<p>Hi</p><img src="cid:missing@mail" alt="x"><img src="https://cdn.example/a.png">');
    expect(out).not.toMatch(/cid:/i);
    expect(out).toContain('hidden');
    expect(out).toContain('src="https://cdn.example/a.png"');
  });

  it('drops cid backgrounds without widening what the frame can load', () => {
    const out = rewriteCidImages('<td style="background:url(cid:bg@mail)"></td>');
    expect(out).not.toMatch(/cid:/i);
    expect(out).toContain('background:none');
  });

  it('reads attachment URLs from message meta', () => {
    const found = attachmentsFromMeta({
      gmail: { attachments: [{ content_id: 'pic@mail', download_url: 'https://cdn.example/pic.jpg' }] },
    });
    expect(found).toEqual([{ contentId: 'pic@mail', url: 'https://cdn.example/pic.jpg' }]);
  });
});
