import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { SectionHead } from "@/components/site/TrendingDeals";

export function HomepagePromotions({ promotions = [] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" data-testid="promotions-section">
      <SectionHead icon={Sparkles} eyebrow="Picked for you" title="Featured promotions" />
      {promotions.length === 0 ? (
        <div className="surface rounded-xl p-6 text-sm text-ink-muted">New savings opportunities are on the way.</div>
      ) : (
        <Carousel className="mx-9" opts={{ align: "start" }} aria-label="Homepage promotions">
          <CarouselContent>
            {promotions.map((promotion) => {
              const isExternal = Boolean(promotion.destination_url);
              const destination = isExternal
                ? promotion.destination_url
                : `/stores?store=${encodeURIComponent(promotion.store_slug)}`;
              const PromotionLink = isExternal ? "a" : Link;
              const image = promotion.desktop_image || promotion.mobile_image;
              return (
                <CarouselItem key={promotion.id} className="sm:basis-1/2">
                  <PromotionLink
                    {...(isExternal ? { href: destination } : { to: destination })}
                    className="surface group block h-full overflow-hidden rounded-xl text-ink transition-colors hover:border-gold/40"
                    data-testid={`homepage-promotion-${promotion.id}`}
                  >
                    <div className="h-40 overflow-hidden bg-black/20 sm:h-44">
                      {image ? (
                        <picture>
                          {promotion.mobile_image && <source media="(max-width: 640px)" srcSet={promotion.mobile_image} />}
                          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </picture>
                      ) : (
                        <div className="grid h-full place-items-center text-gold/60"><Sparkles className="h-8 w-8" aria-hidden="true" /></div>
                      )}
                    </div>
                    <div className="space-y-2 p-4">
                      {promotion.featured && <span className="text-xs font-600 uppercase tracking-wide text-gold">Featured</span>}
                      <h3 className="font-display text-lg font-600">{promotion.title}</h3>
                      {promotion.subtitle && <p className="text-sm text-ink-muted">{promotion.subtitle}</p>}
                      <span className="inline-block text-sm font-600 text-gold group-hover:underline">{promotion.cta_text || "View promotion"} →</span>
                    </div>
                  </PromotionLink>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {promotions.length > 1 && (
            <>
              <CarouselPrevious className="-left-9" />
              <CarouselNext className="-right-9" />
            </>
          )}
        </Carousel>
      )}
    </section>
  );
}
