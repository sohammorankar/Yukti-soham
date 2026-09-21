import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/lib/useMeta";
import { Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  useMeta("Rate Console Sign-in · YuktiCart", "Secure administrator sign-in for the YuktiCart Rate Console.");
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && user.roles?.length) navigate("/admin");
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) { toast.success("Welcome back"); navigate("/admin"); }
    else setError(res.error);
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg btn-gold"><Sparkles className="h-5 w-5" /></span>
          <span className="font-display text-xl font-600 text-ink">Yukti<span className="gold-text">Cart</span></span>
        </Link>
        <div className="surface rounded-2xl p-7">
          <div className="mb-5 flex items-center gap-2">
            <Lock className="h-5 w-5 text-gold" />
            <h1 className="font-display text-xl font-600 text-ink">Rate Console</h1>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                data-testid="admin-email"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                data-testid="admin-password"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="admin-login-error">{error}</p>}
            <button type="submit" disabled={busy} data-testid="admin-login-submit"
              className="btn-gold focus-ring w-full rounded-full py-3 text-sm font-700 disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in securely"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-ink-muted">
            Open registration is disabled. Admin access is granted by allowlist bootstrap only.
          </p>
        </div>
      </div>
    </div>
  );
}
