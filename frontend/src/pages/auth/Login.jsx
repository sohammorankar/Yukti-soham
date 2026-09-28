import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/lib/useMeta";
import { LogIn, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  useMeta("Log in · YuktiCart", "Sign in to your YuktiCart shopper account.");
  const { login, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isAuthed) navigate("/"); }, [isAuthed, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) { toast.success("Welcome back"); navigate("/"); }
    else setError(res.error || "Login failed");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg btn-gold"><Sparkles className="h-5 w-5" /></span>
          <span className="font-display text-xl font-600 text-ink">Yukti<span className="gold-text">Cart</span></span>
        </Link>
        <div className="surface rounded-2xl p-7">
          <div className="mb-5 flex items-center gap-2">
            <LogIn className="h-5 w-5 text-gold" />
            <h1 className="font-display text-xl font-600 text-ink">Log in</h1>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                data-testid="login-email-input"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                data-testid="login-password-input"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
            <button type="submit" disabled={busy} data-testid="login-submit-button"
              className="btn-gold focus-ring w-full rounded-full py-3 text-sm font-700 disabled:opacity-60">
              {busy ? "Signing in…" : "Log in"}
            </button>
          </form>

          <div className="mt-5 space-y-3 text-center text-sm">
            <p className="text-ink-muted">
              New to YuktiCart?{" "}
              <Link to="/signup" data-testid="login-register-link" className="gold-text font-600 hover:underline">Create an account</Link>
            </p>
            <Link to="/" data-testid="continue-as-guest"
              className="focus-ring inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm text-ink-muted hover:text-gold">
              <UserRound className="h-4 w-4" /> Continue as Guest
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
