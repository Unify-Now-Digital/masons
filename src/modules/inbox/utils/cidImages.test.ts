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

  it('rewrites srcset and HTML background, including Gmail cid:ii_ and cid:mf_', () => {
    const out = rewriteCidImages(
      '<img src="CID:ii_logo" srcset="cid:ii_logo 1x, cid:ii_missing 2x" alt="Logo"><td background="cid:mf_bg"></td>',
      [{ contentId: 'ii_logo', url: 'https://cdn.example/logo.png' }],
    );
    expect(out).toContain('src="https://cdn.example/logo.png"');
    expect(out).toContain('srcset="https://cdn.example/logo.png 1x"');
    expect(out).not.toMatch(/cid:/i);
    expect(out).not.toContain('background=');
  });

  it('removes cid from CSS urls written with entity quotes and from non-img tags', () => {
    const out = rewriteCidImages(
      '<div style="background-image:url(&quot;cid:ii_abc&quot;)"></div><v:imagedata src="cid:mf_xyz" />',
    );
    expect(out).not.toMatch(/cid:/i);
    expect(out).toContain('background-image:none');
    expect(out).not.toContain('src=');
  });

  it('reads attachment URLs from message meta', () => {
    const found = attachmentsFromMeta({
      gmail: { attachments: [{ content_id: 'pic@mail', download_url: 'https://cdn.example/pic.jpg' }] },
    });
    expect(found).toEqual([{ contentId: 'pic@mail', url: 'https://cdn.example/pic.jpg' }]);
  });
});
