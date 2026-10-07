import React from "react";
import { Link } from "react-router-dom";
import { getBrandAsset } from "@/lib/assets";

export const StoreSavingsCard = ({ store }) => {
  const image = store.logo_url || store.image_url || getBrandAsset(store.name);
  const testSlug = store.name.toLowerCase().replace(/[^a-z]+/g, "-");
  const destination = store.slug
    ? `/stores/${encodeURIComponent(store.slug)}`
    : `/brands?store=${encodeURIComponent(store.name)}`;

  return (
    <Link to={destination} data-testid={`brand-${testSlug}`}
      className="surface focus-ring group flex min-h-[17rem] flex-col overflow-hidden rounded-lg text-center text-ink transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-gold/50">
      <span className="sr-only">Explore savings at {store.name}</span>
      <div className="flex min-h-12 items-center justify-center px-4 pt-4" data-testid={`brand-${testSlug}-promo-top`}>
        {store.promo_top_text && (
          <p className="line-clamp-2 break-words text-[11px] font-700 uppercase leading-4 text-gold">
            {store.promo_top_text}
          </p>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-4">
        <div className="grid h-24 w-full max-w-[11rem] place-items-center overflow-hidden rounded-lg bg-white/95 p-3" data-testid={`brand-${testSlug}-logo`}>
          {image ? (
            <img src={image} alt={`${store.name} logo`} className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <span className="font-display text-3xl font-700 text-slate-700" aria-hidden="true">
              {store.name?.trim()?.[0]?.toUpperCase() || "Y"}
            </span>
          )}
        </div>
      </div>
      <div className="mx-4 h-px bg-[var(--hairline)]" aria-hidden="true" data-testid={`brand-${testSlug}-divider`} />
      <div className="flex min-h-16 items-center justify-center px-4 py-3" data-testid={`brand-${testSlug}-promo-bottom`}>
        {store.promo_bottom_text && (
          <p className="line-clamp-2 break-words text-sm font-700 leading-5 text-ink transition-colors group-hover:text-gold">
            {store.promo_bottom_text}
          </p>
        )}
      </div>
    </Link>
  );
};