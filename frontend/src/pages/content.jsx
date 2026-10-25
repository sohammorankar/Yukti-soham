import React from "react";
import { PageShell, Block } from "@/components/site/PageShell";

export function About() {
  return (
    <PageShell title="About Us" kicker="Company"
      description="YuktiCart is a tactical savings and checkout-stack engine built for Indian shoppers who want the lowest possible bill — transparently.">
      <Block h="What we do">
        <p>We combine affiliate cashback, discounted gift cards, store discounts and valid split-payment
        rules to compute the single best checkout route for any order. No fluff, just exact rupees.</p>
      </Block>
      <Block h="Why we exist">
        <p>Deals across Amazon, Flipkart, Myntra, Nykaa, Firstcry and more change daily. We track them in
        a managed console and surface only the math that matters — with honest confidence and disclosures.</p>
      </Block>
    </PageShell>
  );
}

export function Mission() {
  return (
    <PageShell title="Our Mission" kicker="Company"
      description="Make every Indian rupee work twice — through mindful, mathematically-optimal shopping.">
      <Block h="Transparency first"><p>We never claim guaranteed cashback. Every result explains its basis,
        eligibility and any verification needed before purchase.</p></Block>
      <Block h="Gratitude built in"><p>Our Aabhar Mandir reminds us that saving is a practice of intention.
        Abundance follows attention.</p></Block>
    </PageShell>
  );
}

export function HowItWorks() {
  return (
    <PageShell title="How It Works" kicker="Method"
      description="Three simple steps, one transparent engine.">
      <Block h="1. Paste or pick"><p>Paste a product URL — we detect the store and best-guess category with a
        confidence score — or choose them manually. You can always override the category.</p></Block>
      <Block h="2. We compute the stack"><p>For your store, category, customer type and price, every eligible
        affiliate and gift-card rule competes on exact rupees. We apply caps, minimum-order values and
        validity windows, then determine whether both routes can be combined (including valid split-payment cases).</p></Block>
      <Block h="3. You follow the sequence"><p>We show the exact checkout order — track through the affiliate,
        buy the gift card, then pay the remainder — for the lowest final effective bill.</p></Block>
      <Block h="Rounding"><p>All internal math uses exact decimals (paise). We round only for display, to the
        nearest rupee using standard commercial rounding, and always compute totals from exact values so rows never disagree.</p></Block>
    </PageShell>
  );
}

export function Privacy() {
  return (
    <PageShell title="Privacy Policy" kicker="Trust & Legal"
      description="We collect the minimum needed to compute savings and improve category matching.">
      <Block h="What we store"><p>Anonymous, aggregated category corrections help us improve detection. We do
        not store full product URLs that may contain personal or tracking parameters.</p></Block>
      <Block h="Cookies & sessions"><p>Admin sessions use secure, httpOnly tokens. See our Cookie Policy for details.</p></Block>
    </PageShell>
  );
}

export function Terms() {
  return (
    <PageShell title="Terms & Conditions" kicker="Trust & Legal"
      description="By using YuktiCart you agree to these terms.">
      <Block h="Indicative information"><p>All rates, categories and savings are indicative and provided for
        convenience. Final classification, eligibility and cashback are decided by the retailer and affiliate platform.</p></Block>
      <Block h="No guarantee"><p>YuktiCart is not liable for changes in retailer terms, tracking exclusions or
        commission after you leave the site.</p></Block>
    </PageShell>
  );
}

export function AffiliateDisclosure() {
  return (
    <PageShell title="Affiliate Disclosure" kicker="Trust & Legal"
      description="How affiliate relationships work on YuktiCart.">
      <Block>
        <p>YuktiCart surfaces cashback available through third-party affiliate platforms. Retailer
        categorization, commission rates, tracking and exclusions <strong>change frequently and are not
        guaranteed</strong>. We select the best match available at the time of calculation, but the final
        classification and cashback are determined by the retailer and the affiliate platform. Always verify
        the category and rate before purchasing.</p>
      </Block>
    </PageShell>
  );
}

export function CashbackDisclaimer() {
  return (
    <PageShell title="Cashback Disclaimer" kicker="Trust & Legal"
      description="Please read before relying on any cashback figure.">
      <Block>
        <p>Cashback amounts shown are <strong>estimates based on rules current at calculation time</strong>.
        Tracking can fail, orders can be excluded, categories can be reclassified, and commission rates can
        change without notice. Nothing on YuktiCart constitutes a guarantee of cashback. Confirm final terms,
        payment eligibility and commission with the retailer and affiliate platform before purchase.</p>
      </Block>
    </PageShell>
  );
}

export function CookiePolicy() {
  return (
    <PageShell title="Cookie Policy" kicker="Trust & Legal"
      description="We use minimal cookies, local storage and analytics.">
      <Block h="Essential only"><p>We store your chosen visual direction and a one-time intro flag locally.
        Admin authentication uses secure session cookies.</p></Block>
      <Block h="Analytics"><p>We use Google Analytics to understand how shoppers use YuktiCart — for
        example when a product link or image is submitted, a calculation completes, an offer is selected,
        a redirect to a partner happens, or a support form is submitted. We do not send passwords, messages,
        uploaded images, full invoices or gift-card codes to analytics, and we do not use advertising
        trackers or ad-personalization cookies.</p></Block>
    </PageShell>
  );
}

const FAQS = [
  ["Is Existing User selected by default?", "Yes. Choose New User only if this is your first eligible transaction with that store or platform."],
  ["Why can't you guarantee cashback?", "Retailers and affiliate platforms control final categorization, tracking and commission, which change often."],
  ["What is split payment?", "When a gift card is capped, you pay part with the gift card and the remainder via UPI/card. The retailer still sees the full order value, so affiliate cashback can remain eligible."],
  ["How often do rates update?", "Amazon and Flipkart can change daily. We keep rates updated and the site reflects the latest instantly."],
];

export function FAQ() {
  return (
    <PageShell title="FAQ" kicker="Help" description="Answers to common questions.">
      {FAQS.map(([q, a]) => (
        <Block key={q} h={q}><p>{a}</p></Block>
      ))}
    </PageShell>
  );
}
