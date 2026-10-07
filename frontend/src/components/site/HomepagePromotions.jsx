import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { SectionHead } from "@/components/site/TrendingDeals";
import { getBrandAsset } from "@/lib/assets";

export function HomepagePromotions({ promotions = [], stores = [] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="promotions-section">
      <SectionHead icon={Sparkles} eyebrow="Worth a closer look" title="Blind Eye Deals"
        sub="Promotions already available through supported stores." />
      {promotions.length === 0 ? (
        <div className="surface rounded-lg p-6 text-sm text-ink-muted" data-testid="blind-eye-deals-empty">New savings opportunities are on the way.</div>
      ) : (
        <Carousel className="sm:mx-9" opts={{ align: "start" }} aria-label="Blind Eye Deals">
          <CarouselContent className="-ml-4">
            {promotions.map((promotion) => {
              const isExternal = Boolean(promotion.destination_url);
              const destination = isExternal
                ? promotion.destination_url
                : `/stores/${encodeURIComponent(promotion.store_slug)}`;
              const PromotionLink = isExternal ? "a" : Link;
              const image = promotion.desktop_image || promotion.mobile_image;
              const store = stores.find((item) => item.id === promotion.store_id);
              const brandLogo = store?.logo_url || getBrandAsset(store?.name);
              return (
                <CarouselItem key={promotion.id} className="pl-4 md:basis-1/2">
                  <PromotionLink
                    {...(isExternal ? { href: destination } : { to: destination })}
                    className="surface group flex h-full flex-col overflow-hidden rounded-lg text-ink transition-colors duration-200 hover:border-gold/40"
                    data-testid={`homepage-promotion-${promotion.id}`}
                  >
                    <div className="relative aspect-video overflow-hidden border-b border-border bg-black/30" data-testid={`homepage-promotion-${promotion.id}-visual`}>
                      {image ? (
                        <picture className="block h-full w-full">
                          {promotion.mobile_image && <source media="(max-width: 640px)" srcSet={promotion.mobile_image} />}
                          <img src={image} alt="" className="h-full w-full object-contain p-1 sm:p-2" loading="lazy" />
                        </picture>
                      ) : (
                        <div className="grid h-full place-items-center text-gold/60"><Sparkles className="h-8 w-8" aria-hidden="true" /></div>
                      )}
                      {brandLogo && (
                        <div className="absolute bottom-3 right-3 grid h-10 w-20 place-items-center rounded-md border border-black/10 bg-white/95 p-1.5 shadow-sm" data-testid={`homepage-promotion-${promotion.id}-brand-logo`}>
                          <img src={brandLogo} alt={`${store.name} logo`} className="h-full w-full object-contain" loading="lazy" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <h3 className="font-display text-lg font-600">{promotion.title}</h3>
                      {promotion.subtitle && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{promotion.subtitle}</p>}
                      <span className="mt-4 inline-block text-sm font-600 text-gold group-hover:underline">{promotion.cta_text || "View promotion"} →</span>
                    </div>
                  </PromotionLink>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {promotions.length > 1 && (
            <>
              <CarouselPrevious className="-left-9 hidden sm:inline-flex" />
              <CarouselNext className="-right-9 hidden sm:inline-flex" />
            </>
          )}
        </Carousel>
      )}
    </section>
  );
}
