import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const AUTOPLAY_MS = 5500;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => setReduced(event.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);
  return reduced;
}

// Admin-managed promotional banner carousel, shown above the savings engine.
// Only ever receives already-filtered (active + in-window) banners from the backend.
export function BannerCarousel({ banners = [] }) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const goTo = useCallback((next) => {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
  }, [count]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion]);

  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  if (count === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6" data-testid="banner-carousel-fallback">
        <div className="surface relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl border-dashed sm:aspect-[21/6]">
          <div className="grid-texture pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative flex flex-col items-center gap-2 px-6 text-center">
            <Sparkles className="h-6 w-6 text-gold" aria-hidden="true" />
            <p className="font-display text-lg font-600 text-ink">Fresh YuktiCart deals are landing here soon</p>
            <p className="text-sm text-ink-muted">Check back shortly for curated store offers.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mx-auto max-w-7xl px-4 pt-6 sm:px-6"
      data-testid="banner-carousel"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-border"
        role="region"
        aria-roledescription="carousel"
        aria-label="Promotions"
        onKeyDownCapture={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); goPrev(); }
          else if (event.key === "ArrowRight") { event.preventDefault(); goNext(); }
        }}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(-${index * 100}%)`,
            transition: reducedMotion ? "none" : "transform 500ms ease",
          }}
        >
          {banners.map((banner, slideIndex) => {
            const isCurrent = slideIndex === index;
            const hasLink = Boolean(banner.destination_url);
            const Wrapper = hasLink ? "a" : "div";
            const wrapperProps = hasLink
              ? { href: banner.destination_url, target: "_blank", rel: "noopener noreferrer", tabIndex: isCurrent ? 0 : -1 }
              : {};
            return (
              <div
                key={banner.id}
                className="aspect-[16/9] w-full shrink-0 grow-0 basis-full sm:aspect-[21/6]"
                role="group"
                aria-roledescription="slide"
                aria-hidden={!isCurrent}
                data-testid={`banner-slide-${banner.id}`}
              >
                <Wrapper
                  {...wrapperProps}
                  className={`relative block h-full w-full bg-black/20 ${hasLink ? "cursor-pointer" : ""}`}
                  data-testid={`banner-slide-${banner.id}-link`}
                >
                  <img
                    src={banner.image_url}
                    alt={banner.alt_text}
                    className="h-full w-full object-cover"
                    loading={slideIndex === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                  {banner.title && (
                    <span
                      className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 pt-10 font-display text-base font-600 text-white sm:text-lg"
                      data-testid={`banner-slide-${banner.id}-title`}
                    >
                      {banner.title}
                    </span>
                  )}
                </Wrapper>
              </div>
            );
          })}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous banner"
              data-testid="banner-carousel-prev"
              className="focus-ring absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/90 text-ink backdrop-blur transition-colors hover:text-gold"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next banner"
              data-testid="banner-carousel-next"
              className="focus-ring absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/90 text-ink backdrop-blur transition-colors hover:text-gold"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5" data-testid="banner-carousel-dots">
              {banners.map((banner, dotIndex) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => goTo(dotIndex)}
                  aria-label={`Go to banner ${dotIndex + 1}`}
                  aria-current={dotIndex === index}
                  data-testid={`banner-carousel-dot-${dotIndex}`}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${
                    dotIndex === index ? "w-6 bg-gold" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
