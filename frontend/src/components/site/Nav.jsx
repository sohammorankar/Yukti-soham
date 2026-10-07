import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Palette, LogIn, LogOut, CreditCard, Search, LifeBuoy, MessageCircle } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/site/Logo";

const WHATSAPP_URL = `https://wa.me/919156968318?text=${encodeURIComponent("Hello YuktiCart Support, I need help.")}`;

// Small avatar: shows the user's uploaded/linked image when present, otherwise a
// clean initial fallback. Never renders any card/financial info.
function ProfileAvatar({ user, size = "h-6 w-6" }) {
  const label = (user?.full_name || user?.name || user?.email || "?").trim();
  const initial = label ? label[0].toUpperCase() : "?";
  if (user?.avatar_url) {
    return (
      <img src={user.avatar_url} alt="Your profile" referrerPolicy="no-referrer"
        className={`${size} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-full btn-gold text-xs font-700`}>
      {initial}
    </span>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { reopenSelector } = useTheme();
  const { isAuthed, user, logout } = useAuth();
  const navigate = useNavigate();

  const firstName = (user?.full_name || user?.name || user?.email || "").split(/[\s@]/)[0];
  const handleLogout = async () => { await logout(); setOpen(false); navigate("/"); };

  // The navbar search area feeds the existing Savings Engine on the homepage
  // (via the ?u= query param) — it does NOT change any calculation logic.
  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    setOpen(false);
    navigate(q ? `/?u=${encodeURIComponent(q)}#engine` : "/#engine");
  };

  return (
    <header className="sticky top-0 z-40 glass" data-testid="site-nav">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Logo />

        {/* Long product / URL search area — routes to the homepage Savings Engine */}
        <form onSubmit={handleSearch} data-testid="nav-search-form"
          className="relative min-w-0 flex-1" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="nav-search-input"
            aria-label="Paste a product link"
            placeholder="Paste a product link to find your lowest bill…"
            className="focus-ring h-10 w-full rounded-full border border-border bg-white pl-9 pr-3 text-sm text-black placeholder:text-slate-500"
          />
        </form>

        {/* Right controls */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={reopenSelector}
            data-testid="nav-theme"
            title="Change visual direction"
            className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-border text-ink-muted transition-colors hover:text-gold"
          >
            <Palette className="h-4 w-4" />
          </button>

          <Link to="/contact" data-testid="nav-support" title="Support"
            className="focus-ring hidden h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-ink-muted transition-colors hover:text-gold sm:inline-flex">
            <LifeBuoy className="h-4 w-4 text-gold" /> Support
          </Link>

          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer"
            data-testid="nav-whatsapp" title="Chat with YuktiCart Support on WhatsApp"
            aria-label="Chat with YuktiCart Support on WhatsApp"
            className="focus-ring hidden h-9 items-center gap-1.5 rounded-full border border-border px-2.5 text-sm text-ink-muted transition-colors hover:text-emerald-500 sm:inline-flex">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            <span className="hidden xl:inline">WhatsApp</span>
          </a>

          {isAuthed ? (
            <div className="hidden items-center gap-2 lg:flex">
              <Link to="/account/cards" data-testid="nav-my-cards" title="My Cards & Offers"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-ink-muted transition-colors hover:text-gold">
                <CreditCard className="h-4 w-4 text-gold" /> My Cards
              </Link>
              <Link to="/account/profile" data-testid="nav-profile" title="View & edit profile"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-2.5 text-sm text-ink transition-colors hover:text-gold">
                <ProfileAvatar user={user} /> Hi, {firstName}
              </Link>
              <button onClick={handleLogout} data-testid="nav-logout" title="Log out"
                className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-border text-ink-muted transition-colors hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" data-testid="nav-login"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-ink-muted transition-colors hover:text-gold">
                <LogIn className="h-3.5 w-3.5" /> Log in
              </Link>
              <Link to="/signup" data-testid="nav-signup"
                className="focus-ring hidden h-9 items-center gap-1.5 rounded-full border border-gold/40 px-3 text-sm text-gold transition-colors hover:bg-gold/10 lg:inline-flex">
                Sign up
              </Link>
            </div>
          )}

          {/* Compact profile shortcut on small screens for authed users */}
          {isAuthed && (
            <Link to="/account/profile" data-testid="nav-profile-mobile" title="Profile"
              className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-border lg:hidden">
              <ProfileAvatar user={user} />
            </Link>
          )}

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
            <Link to="/contact" onClick={() => setOpen(false)} data-testid="nav-support-mobile"
              className="rounded-md px-3 py-2 text-sm text-ink-muted hover:text-gold">Support</Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" data-testid="nav-whatsapp-mobile"
              aria-label="Chat with YuktiCart Support on WhatsApp" title="Chat with YuktiCart Support on WhatsApp"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted hover:text-emerald-500">
              <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp support
            </a>
            <div className="my-1 border-t border-border" />
            {isAuthed ? (
              <>
                <Link to="/account/profile" onClick={() => setOpen(false)} data-testid="nav-profile-mobile-link"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:text-gold">
                  <ProfileAvatar user={user} /> {firstName} — View profile
                </Link>
                <Link to="/account/cards" onClick={() => setOpen(false)} data-testid="nav-my-cards-mobile"
                  className="rounded-md px-3 py-2 text-sm text-ink-muted hover:text-gold">My Cards &amp; Offers</Link>
                <button onClick={handleLogout} data-testid="nav-logout-mobile"
                  className="rounded-md px-3 py-2 text-left text-sm text-ink-muted hover:text-destructive">Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} data-testid="nav-login-mobile"
                  className="rounded-md px-3 py-2 text-sm text-ink-muted hover:text-gold">Log in</Link>
                <Link to="/signup" onClick={() => setOpen(false)} data-testid="nav-signup-mobile"
                  className="rounded-md px-3 py-2 text-sm text-gold">Create account</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
