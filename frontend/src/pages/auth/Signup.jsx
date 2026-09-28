import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/lib/useMeta";
import { UserPlus, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";

const GENDERS = [
  ["female", "Female"],
  ["male", "Male"],
  ["other", "Other"],
  ["prefer_not", "Prefer not to say"],
];

// India mobile: 10 digits starting 6-9, optional +91 prefix.
function normalizeMobile(v) {
  const digits = (v || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}
function isValidMobile(v) {
  return /^[6-9]\d{9}$/.test(normalizeMobile(v));
}
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
}

export default function Signup() {
  useMeta("Create account · YuktiCart", "Create your YuktiCart shopper account to save smarter.");
  const { register, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", gender: "", mobile: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isAuthed) navigate("/"); }, [isAuthed, navigate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const err = {};
    if (!form.mobile.trim()) err.mobile = "Mobile number is required";
    else if (!isValidMobile(form.mobile)) err.mobile = "Enter a valid 10-digit Indian mobile number";
    if (!form.email.trim()) err.email = "Email is required";
    else if (!isValidEmail(form.email)) err.email = "Enter a valid email address";
    if (!form.password) err.password = "Password is required";
    else if (form.password.length < 8) err.password = "At least 8 characters";
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) err.password = "Include a letter and a number";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    setBusy(true);
    const res = await register({
      full_name: form.full_name.trim() || null,
      gender: form.gender || null,
      mobile: normalizeMobile(form.mobile),
      email: form.email.trim(),
      password: form.password,
    });
    setBusy(false);
    if (res.ok) { toast.success("Account created — welcome to YuktiCart!"); navigate("/"); }
    else setServerError(res.error || "Could not create your account");
  };

  const inputCls = "focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground";

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg btn-gold"><Sparkles className="h-5 w-5" /></span>
          <span className="font-display text-xl font-600 text-ink">Yukti<span className="gold-text">Cart</span></span>
        </Link>
        <div className="surface rounded-2xl p-7">
          <div className="mb-5 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gold" />
            <h1 className="font-display text-xl font-600 text-ink">Create your account</h1>
          </div>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Full name</label>
              <input value={form.full_name} onChange={set("full_name")} data-testid="register-name-input"
                placeholder="Optional" className={inputCls} />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Gender</span>
              <div className="flex flex-wrap gap-x-5 gap-y-2" role="radiogroup" data-testid="register-gender">
                {GENDERS.map(([val, label]) => (
                  <label key={val} className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="radio" name="gender" value={val} checked={form.gender === val}
                      onChange={set("gender")} data-testid={`register-gender-${val}`}
                      className="h-4 w-4 accent-[var(--gold,#d4af37)]" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Mobile *</label>
              <input value={form.mobile} onChange={set("mobile")} inputMode="numeric" data-testid="register-mobile-input"
                placeholder="10-digit mobile" className={inputCls} />
              {errors.mobile && <p className="mt-1 text-xs text-destructive" data-testid="register-mobile-error">{errors.mobile}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Email *</label>
              <input type="email" value={form.email} onChange={set("email")} data-testid="register-email-input"
                className={inputCls} />
              {errors.email && <p className="mt-1 text-xs text-destructive" data-testid="register-email-error">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Password *</label>
              <input type="password" value={form.password} onChange={set("password")} data-testid="register-password-input"
                placeholder="Min 8 chars, a letter & a number" className={inputCls} />
              {errors.password && <p className="mt-1 text-xs text-destructive" data-testid="register-password-error">{errors.password}</p>}
            </div>

            {serverError && <p className="text-sm text-destructive" data-testid="register-error">{serverError}</p>}

            <button type="submit" disabled={busy} data-testid="register-submit-button"
              className="btn-gold focus-ring w-full rounded-full py-3 text-sm font-700 disabled:opacity-60">
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div className="mt-5 space-y-3 text-center text-sm">
            <p className="text-ink-muted">
              Already have an account?{" "}
              <Link to="/login" data-testid="register-login-link" className="gold-text font-600 hover:underline">Log in</Link>
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
