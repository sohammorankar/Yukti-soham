import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Mail } from "lucide-react";

const COLS = [
  {
    title: "Product",
    links: [
      { to: "/", label: "Savings Engine" },
      { to: "/deals", label: "Trending Deals" },
      { to: "/brands", label: "Brands" },
      { to: "/categories", label: "Categories" },
      { to: "/admin/login", label: "Rate Console" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About Us" },
      { to: "/mission", label: "Our Mission" },
      { to: "/how-it-works", label: "How It Works" },
      { to: "/contact", label: "Contact Us" },
    ],
  },
  {
    title: "Trust & Legal",
    links: [
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/terms", label: "Terms & Conditions" },
      { to: "/affiliate-disclosure", label: "Affiliate Disclosure" },
      { to: "/cashback-disclaimer", label: "Cashback Disclaimer" },
      { to: "/cookie-policy", label: "Cookie Policy" },
    ],
  },
  {
    title: "Help",
    links: [
      { to: "/faq", label: "FAQ" },
      { to: "/report-rate", label: "Report an Incorrect Rate" },
      { to: "/suggest", label: "Suggest a Store or Platform" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border" data-testid="site-footer">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg btn-gold">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-600 text-ink">
              Yukti<span className="gold-text">Cart</span>
            </span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            A tactical savings and checkout-stack engine for Indian shoppers. We find the
            mathematically best payment route across affiliate cashback and discounted gift cards.
          </p>
          <a href="mailto:hello@yukticart.com" className="mt-4 inline-flex items-center gap-2 text-sm text-gold hover:underline">
            <Mail className="h-4 w-4" /> hello@yukticart.com
          </a>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="font-display text-sm font-600 text-ink">{col.title}</h4>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    data-testid={`footer-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                    className="text-sm text-ink-muted transition-colors hover:text-gold"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-ink-muted sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} YuktiCart. Contact details are placeholders — update in the console.</span>
          <span>Cashback & category rates are indicative and not guaranteed. Verify before purchase.</span>
        </div>
      </div>
    </footer>
  );
}
