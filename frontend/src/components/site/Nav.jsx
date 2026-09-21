import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Lock, Sparkles, Palette, Flame } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const LINKS = [
  { to: "/deals", label: "Deals" },
  { to: "/brands", label: "Brands" },
  { to: "/categories", label: "Categories" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function Nav({ onOpenMandir }) {
  const [open, setOpen] = useState(false);
  const { reopenSelector } = useTheme();
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-40 glass" data-testid="site-nav">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 focus-ring rounded-md" data-testid="nav-logo">
          <span className="grid h-9 w-9 place-items-center rounded-lg btn-gold">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-600 tracking-tight text-ink">
            Yukti<span className="gold-text">Cart</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={`nav-${l.label.toLowerCase().replace(/ /g, "-")}`}
              className={`rounded-md px-3 py-2 text-sm transition-colors hover:text-gold ${
                loc.pathname === l.to ? "text-gold" : "text-ink-muted"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenMandir}
            data-testid="nav-mandir"
            title="Aabhar Mandir — gratitude"
            className="focus-ring hidden h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-ink-muted transition-colors hover:text-gold sm:flex"
          >
            <Flame className="h-4 w-4 text-gold" /> Aabhar
          </button>
          <button
            onClick={reopenSelector}
            data-testid="nav-theme"
            title="Change visual direction"
            className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-border text-ink-muted transition-colors hover:text-gold"
          >
            <Palette className="h-4 w-4" />
          </button>
          <Link
            to="/admin/login"
            data-testid="nav-rate-console"
            className="focus-ring hidden h-9 items-center gap-1.5 rounded-full border border-gold/40 px-3 text-sm text-gold transition-colors hover:bg-gold/10 sm:flex"
          >
            <Lock className="h-3.5 w-3.5" /> Rate Console
          </Link>
          <button
            className="focus-ring grid h-9 w-9 place-items-center rounded-md lg:hidden"
            onClick={() => setOpen((v) => !v)}
            data-testid="nav-mobile-toggle"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3 lg:hidden" data-testid="nav-mobile-menu">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-ink-muted hover:text-gold">
                {l.label}
              </Link>
            ))}
            <Link to="/admin/login" onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-gold">Rate Console</Link>
          </div>
        </div>
      )}
    </header>
  );
}
