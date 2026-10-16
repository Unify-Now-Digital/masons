import React from 'react';
import { Link } from 'react-router-dom';

/** Product thumbnail row used inside an Enquiry or Order section. */
export const ProductCard: React.FC<{
  name: string;
  spec?: string | null;
  imageUrl?: string | null;
  href?: string | null;
}> = ({ name, spec, imageUrl, href }) => (
  <div className="flex items-center gap-3">
    {imageUrl ? (
      <img src={imageUrl} alt="" className="h-16 w-12 shrink-0 rounded-lg border border-gardens-bdr object-cover" />
    ) : (
      <span className="h-16 w-12 shrink-0 rounded-lg border border-gardens-bdr bg-gardens-page" aria-hidden />
    )}
    <span className="flex min-w-0 flex-col">
      {href ? (
        <Link to={href} className="truncate text-[13px] font-semibold text-gardens-acc-dk">{name}</Link>
      ) : (
        <span className="truncate text-[13px] font-medium text-gardens-tx">{name}</span>
      )}
      {spec ? <span className="truncate text-[12px] text-gardens-txs">{spec}</span> : null}
    </span>
  </div>
);
