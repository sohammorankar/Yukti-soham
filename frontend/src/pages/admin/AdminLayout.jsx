import React from "react";
import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Boxes, Store, Tags, Grid3x3, ScrollText, LogOut, Sparkles, Table2, CreditCard, Link2,
} from "lucide-react";

const ITEMS = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/rates", label: "Rate Editor", icon: Table2 },
  { to: "/admin/matrix", label: "Rate Matrix", icon: Grid3x3 },
  { to: "/admin/platforms", label: "Platforms", icon: Boxes },
  { to: "/admin/stores", label: "Stores & Domains", icon: Store },
  { to: "/admin/categories", label: "Categories & Keywords", icon: Tags },
  { to: "/admin/affiliate-destinations", label: "Affiliate Destinations", icon: Link2 },
  { to: "/admin/cards", label: "Card Catalogue", icon: CreditCard },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export default function AdminLayout() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();

  if (!ready) return <div className="grid min-h-screen place-items-center text-ink-muted">Checking access…</div>;
  if (!user || !user.roles?.length) return <Navigate to="/admin/login" replace />;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg btn-gold"><Sparkles className="h-4 w-4" /></span>
          <span className="font-display text-lg font-600 text-ink">Console</span>
        </div>
        <nav className="flex-1 space-y-1">
          {ITEMS.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}
              data-testid={`admin-nav-${it.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive ? "btn-gold font-600" : "text-ink-muted hover:text-gold"}`}>
              <it.icon className="h-4 w-4" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-border pt-4">
          <p className="px-3 text-xs text-ink-muted">{user.email}</p>
          <p className="px-3 text-[10px] uppercase tracking-wide text-gold">{user.roles.join(", ")}</p>
          <button onClick={async () => { await logout(); navigate("/admin/login"); }}
            data-testid="admin-logout"
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted hover:text-destructive">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 overflow-x-hidden">
        {/* mobile top bar */}
        <div className="flex items-center justify-between border-b border-border bg-surface p-3 lg:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {ITEMS.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => `whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs ${isActive ? "text-gold" : "text-ink-muted"}`}>
                {it.label}
              </NavLink>
            ))}
          </div>
          <button onClick={async () => { await logout(); navigate("/admin/login"); }} className="text-ink-muted"><LogOut className="h-4 w-4" /></button>
        </div>
        <div className="p-4 sm:p-6"><Outlet /></div>
      </div>
    </div>
  );
}
