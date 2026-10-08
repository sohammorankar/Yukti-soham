import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Gift,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { getBrandAsset } from "@/lib/assets";
import { useMeta } from "@/lib/useMeta";

export default function StorePage() {
  const { slug } = useParams();

  const [load, setLoad] = useState({
    slug: null,
    status: "loading",
    store: null,
  });

  const [retry, setRetry] = useState(0);

  const current =
    load.slug === slug
      ? load
      : { status: "loading", store: null };

  const store = current.status === "ready" ? current.store : null;

  // Keep every Store Page CTA store-aware so the Savings Engine
  // can automatically select this store from its slug.
  const engineUrl = store
    ? `/?store=${encodeURIComponent(store.slug || slug)}#engine`
    : "/#engine";

  useMeta(
    store
      ? `Save at ${store.name} | YuktiCart`
      : "Store savings | YuktiCart",
    store?.description ||
      "Explore store savings and find your best checkout route with YuktiCart."
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setLoad({
      slug,
      status: "loading",
      store: null,
    });

    api
      .get(`/public/stores/${encodeURIComponent(slug)}`, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (active) {
          setLoad({
            slug,
            status: "ready",
            store: data,
          });
        }
      })
      .catch((error) => {
        if (!active) return;

        setLoad({
          slug,
          status:
            error.response?.status === 404
              ? "not-found"
              : "error",
          store: null,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, retry]);

  /*
   * Preserve the existing category source-of-truth:
   * category_groups → categories.
   *
   * We do not invent categories or perform fuzzy matching here.
   */
  const categorySource =
    Array.isArray(store?.category_groups) &&
    store.category_groups.length
      ? store.category_groups
      : store?.categories;

  const categories = Array.isArray(categorySource)
    ? categorySource.filter(
        (category) =>
          typeof category?.name === "string" &&
          category.name.trim() &&
          category.name.trim().toLowerCase() !== "all"
      )
    : [];

  /*
   * Preserve the existing logo fallback chain.
   */
  const image =
    store &&
    (store.logo_url ||
      store.image_url ||
      getBrandAsset(store.name));

  /*
   * Existing store fields are optional.
   * They are presentation-only and do not affect calculations.
   */
  const promoTopText =
    typeof store?.promo_top_text === "string"
      ? store.promo_top_text.trim()
      : "";

  const promoBottomText =
    typeof store?.promo_bottom_text === "string"
      ? store.promo_bottom_text.trim()
      : "";

  /*
   * Use the existing store category objects.
   *
   * IMPORTANT:
   * We only create a category link when the backend provides
   * an actual slug. We do NOT generate our own slug here.
   */
  const getCategoryHref = (category) => {
    if (
      typeof category?.slug === "string" &&
      category.slug.trim()
    ) {
      return `/category/${encodeURIComponent(
        category.slug.trim()
      )}`;
    }

    return null;
  };

  return (
    <section
      className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8"
      data-testid="store-page"
    >
      {/* =====================================================
          BACK TO STORES
      ====================================================== */}
      <Link
        to="/stores"
        className="group inline-flex items-center gap-2 rounded-full border border-transparent px-2 py-1.5 text-sm font-600 text-gold transition hover:border-gold/20 hover:bg-gold/5"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        All stores
      </Link>

      {/* =====================================================
          LOADING
      ====================================================== */}
      {current.status === "loading" && (
        <div
          role="status"
          className="surface mt-7 rounded-2xl p-7"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-64 max-w-full animate-pulse rounded bg-white/10" />
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="h-44 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-44 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      )}

      {/* =====================================================
          NOT FOUND
      ====================================================== */}
      {current.status === "not-found" && (
        <div className="surface mt-7 rounded-2xl border border-white/10 p-7 sm:p-9">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-gold">
            <Store className="h-6 w-6" />
          </div>

          <h1 className="mt-5 font-display text-3xl font-600 text-ink">
            Store not found
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
            This store page is not available right now. Browse the
            active stores to find another savings destination.
          </p>

          <Link
            to="/stores"
            className="btn-gold mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-700"
          >
            Browse stores
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* =====================================================
          ERROR
      ====================================================== */}
      {current.status === "error" && (
        <div
          className="surface mt-7 rounded-2xl border border-red-400/20 p-7 sm:p-9"
          role="alert"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-400/10 text-red-300">
            <Store className="h-6 w-6" />
          </div>

          <h1 className="mt-5 font-display text-2xl font-600 text-ink">
            Store details are unavailable
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            We couldn't load this store right now. Please try again.
          </p>

          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/30 px-5 py-2.5 text-sm font-700 text-gold transition hover:bg-gold/10"
          >
            Try again
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =====================================================
          STORE CONTENT
      ====================================================== */}
      {store && (
        <>
          {/* =================================================
              PREMIUM STORE HERO
          ================================================== */}
          <div className="relative mt-7 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_85%_10%,rgba(245,201,74,0.14),transparent_32%),linear-gradient(145deg,rgba(12,22,25,0.98),rgba(6,12,14,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            {/* Decorative glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold/10 blur-3xl"
            />

            <div className="relative grid gap-7 p-5 sm:p-7 lg:grid-cols-[1fr_320px] lg:p-9">
              {/* Left */}
              <div className="flex flex-col justify-center">
                {store.featured && (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-[11px] font-700 uppercase tracking-[0.14em] text-gold">
                    <Sparkles className="h-3.5 w-3.5" />
                    Featured store
                  </span>
                )}

                {!store.featured && (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-700 uppercase tracking-[0.14em] text-ink-muted">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Store savings
                  </span>
                )}

                <h1 className="mt-5 max-w-3xl font-display text-4xl font-600 leading-[1.02] text-ink sm:text-5xl lg:text-6xl">
                  Shop smarter.
                  <br />
                  <span className="text-gold">
                    Stack every saving.
                  </span>
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">
                  Find the best available savings route for{" "}
                  <span className="font-700 text-ink">
                    {store.name}
                  </span>{" "}
                  before you checkout.
                </p>

                {store.description && (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">
                    {store.description}
                  </p>
                )}

                {/* Admin-controlled promotional text */}
                {promoTopText && (
                  <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl border border-gold/20 bg-gold/[0.06] px-4 py-2.5 text-sm font-700 text-gold">
                    <Tag className="h-4 w-4 shrink-0" />
                    {promoTopText}
                  </div>
                )}

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    to={engineUrl}
                    data-testid="store-savings-cta"
                    className="btn-gold inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-800 shadow-[0_8px_30px_rgba(245,201,74,0.16)] transition hover:-translate-y-0.5"
                  >
                    Find Best Savings Stack
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <a
                    href="#store-categories"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-700 text-ink transition hover:border-gold/20 hover:bg-gold/5"
                  >
                    Explore categories
                  </a>
                </div>

                <p className="mt-3 text-xs text-ink-muted">
                  Choose your product first. YuktiCart calculates the
                  applicable route before you checkout.
                </p>
              </div>

              {/* Right store identity card */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6">
                <div>
                  <div className="grid h-32 w-full place-items-center overflow-hidden rounded-2xl bg-white p-5 shadow-inner sm:h-36">
                    {image ? (
                      <img
                        src={image}
                        alt={`${store.name} logo`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Store
                        className="h-12 w-12 text-slate-600"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="mt-5 flex items-center gap-2 text-xs font-700 text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Active store
                  </div>

                  <h2 className="mt-2 font-display text-2xl font-600 text-ink">
                    {store.name}
                  </h2>

                  <p className="mt-2 text-xs leading-5 text-ink-muted">
                    Savings depend on your purchase, category,
                    customer type and current store rules.
                  </p>
                </div>

                {promoBottomText && (
                  <div className="mt-6 border-t border-white/10 pt-5">
                    <p className="text-sm font-800 text-gold">
                      {promoBottomText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =================================================
              SAVINGS ROUTES
          ================================================== */}
          <section className="mt-10">
            <div className="mb-5">
              <p className="text-xs font-700 uppercase tracking-[0.16em] text-gold">
                YuktiCart advantage
              </p>

              <h2 className="mt-2 font-display text-3xl font-600 text-ink">
                Why check {store.name} through YuktiCart?
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
                Instead of checking savings options one by one,
                use the Savings Engine to evaluate the applicable
                routes together.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="surface group rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-gold/20">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold">
                  <Zap className="h-5 w-5" />
                </div>

                <h3 className="mt-4 font-700 text-ink">
                  Best route
                </h3>

                <p className="mt-2 text-sm leading-5 text-ink-muted">
                  Compare applicable savings paths before checkout.
                </p>
              </div>

              <div className="surface group rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-gold/20">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <Gift className="h-5 w-5" />
                </div>

                <h3 className="mt-4 font-700 text-ink">
                  Gift-card route
                </h3>

                <p className="mt-2 text-sm leading-5 text-ink-muted">
                  Consider eligible discounted gift-card routes when
                  current rules allow them.
                </p>
              </div>

              <div className="surface group rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-gold/20">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
                  <CreditCard className="h-5 w-5" />
                </div>

                <h3 className="mt-4 font-700 text-ink">
                  Card-aware
                </h3>

                <p className="mt-2 text-sm leading-5 text-ink-muted">
                  Apply eligible payment-card rules where available.
                </p>
              </div>

              <div className="surface group rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-gold/20">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-400/10 text-violet-300">
                  <ShoppingBag className="h-5 w-5" />
                </div>

                <h3 className="mt-4 font-700 text-ink">
                  Final bill
                </h3>

                <p className="mt-2 text-sm leading-5 text-ink-muted">
                  Focus on the route that can produce the lowest
                  effective cost.
                </p>
              </div>
            </div>
          </section>

          {/* =================================================
              CUSTOMER TYPE NOTICE
          ================================================== */}
          {store.has_customer_type_rules && (
            <section className="mt-6 rounded-2xl border border-gold/20 bg-gold/[0.045] p-5 sm:p-6">
              <div className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
                  <Search className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-700 text-ink">
                    Your customer type can affect the saving
                  </h2>

                  <p
                    className="mt-1 text-sm leading-6 text-ink-muted"
                    data-testid="store-customer-type"
                  >
                    Savings may vary by customer type. Choose your
                    type in the Savings Engine so YuktiCart can apply
                    the relevant store rules.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* =================================================
              STORE CATEGORIES
          ================================================== */}
          <section
            id="store-categories"
            className="mt-10"
            data-testid="store-categories"
          >
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-700 uppercase tracking-[0.16em] text-gold">
                  Explore
                </p>

                <h2 className="mt-2 font-display text-3xl font-600 text-ink">
                  Shop by {store.name} category
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
                  Categories shown here come from the store's current
                  eligible savings rules.
                </p>
              </div>

              <Link
                to={engineUrl}
                className="inline-flex w-fit items-center gap-1.5 text-sm font-700 text-gold hover:underline"
              >
                Open Savings Engine
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {categories.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => {
                  const href = getCategoryHref(category);

                  const content = (
                    <>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
                        <Tag className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-700 text-ink">
                          {category.name}
                        </span>

                        {href && (
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            Explore savings
                          </span>
                        )}
                      </span>

                      {href && (
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-gold" />
                      )}
                    </>
                  );

                  if (href) {
                    return (
                      <Link
                        key={category.name}
                        to={href}
                        className="group surface flex min-h-[66px] items-center gap-3 rounded-xl p-3 transition hover:-translate-y-0.5 hover:border-gold/25 hover:bg-gold/[0.025]"
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={category.name}
                      className="surface flex min-h-[66px] items-center gap-3 rounded-xl p-3"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="surface rounded-2xl p-6">
                <p className="text-sm leading-6 text-ink-muted">
                  No category-specific affiliate options are currently
                  listed for this store.
                </p>
              </div>
            )}
          </section>

          {/* =================================================
              HOW IT WORKS
          ================================================== */}
          <section className="mt-10">
            <div className="surface overflow-hidden rounded-3xl">
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.85fr_1.15fr] lg:p-10">
                <div>
                  <p className="text-xs font-700 uppercase tracking-[0.16em] text-gold">
                    Simple process
                  </p>

                  <h2 className="mt-2 font-display text-3xl font-600 text-ink sm:text-4xl">
                    Find your best route before you pay.
                  </h2>

                  <p className="mt-4 text-sm leading-6 text-ink-muted">
                    YuktiCart is designed to help you make the savings
                    decision first, then continue to the appropriate
                    shopping destination.
                  </p>

                  <Link
                    to={engineUrl}
                    className="btn-gold mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-800"
                  >
                    Find Best Savings Stack
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="text-xs font-800 text-gold">
                      01
                    </div>

                    <h3 className="mt-3 font-700 text-ink">
                      Add your product
                    </h3>

                    <p className="mt-2 text-sm leading-5 text-ink-muted">
                      Paste the product URL into the Savings Engine.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="text-xs font-800 text-gold">
                      02
                    </div>

                    <h3 className="mt-3 font-700 text-ink">
                      Confirm details
                    </h3>

                    <p className="mt-2 text-sm leading-5 text-ink-muted">
                      Confirm the store, category and shopper inputs.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="text-xs font-800 text-gold">
                      03
                    </div>

                    <h3 className="mt-3 font-700 text-ink">
                      Calculate the stack
                    </h3>

                    <p className="mt-2 text-sm leading-5 text-ink-muted">
                      YuktiCart evaluates applicable savings routes.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="text-xs font-800 text-gold">
                      04
                    </div>

                    <h3 className="mt-3 font-700 text-ink">
                      Continue to checkout
                    </h3>

                    <p className="mt-2 text-sm leading-5 text-ink-muted">
                      Follow the recommended route and complete your
                      purchase.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =================================================
              TRUST / RULE NOTE
          ================================================== */}
          <section className="mt-6">
            <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

              <div>
                <h3 className="text-sm font-800 text-ink">
                  Savings are rule-aware
                </h3>

                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  Availability and savings can vary by product,
                  category, customer type, payment method and current
                  partner rules. YuktiCart shows applicable options
                  rather than promising a saving for every purchase.
                </p>
              </div>
            </div>
          </section>

          {/* =================================================
              FINAL CTA
          ================================================== */}
          <section className="mt-8">
            <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-[radial-gradient(circle_at_90%_20%,rgba(245,201,74,0.14),transparent_32%),linear-gradient(135deg,rgba(245,201,74,0.06),rgba(10,18,21,0.96))] p-6 sm:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-gold/10 blur-3xl"
              />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-700 uppercase tracking-[0.16em] text-gold">
                    Ready to save?
                  </p>

                  <h2 className="mt-2 font-display text-2xl font-600 text-ink sm:text-3xl">
                    Find the best {store.name} savings route.
                  </h2>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
                    Run your product through the Savings Engine before
                    you checkout.
                  </p>
                </div>

                <Link
                  to={engineUrl}
                  className="btn-gold inline-flex w-fit shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-800"
                >
                  Start Saving
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
