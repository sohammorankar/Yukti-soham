import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMeta } from "@/lib/useMeta";
import { UserRound, CreditCard, ShieldCheck, Camera, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const GENDERS = [
  ["female", "Female"],
  ["male", "Male"],
  ["other", "Other"],
  ["prefer_not", "Prefer not to say"],
];

function normalizeMobile(v) {
  const digits = (v || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}
function isValidMobile(v) {
  return !v || /^[6-9]\d{9}$/.test(normalizeMobile(v));
}

export default function Profile() {
  useMeta("Your profile · YuktiCart", "View and complete your YuktiCart shopper profile.");
  const { user, ready, isAuthed, updateProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [form, setForm] = useState({ full_name: "", gender: "", mobile: "", avatar_url: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  // Redirect guests to login once auth state is known.
  useEffect(() => {
    if (ready && !isAuthed) navigate("/login");
  }, [ready, isAuthed, navigate]);

  // Hydrate the form from the authenticated user's existing profile.
  useEffect(() => {
    if (user && user.email) {
      setForm({
        full_name: user.full_name || user.name || "",
        gender: user.gender || "",
        mobile: user.mobile || "",
        avatar_url: user.avatar_url || "",
      });
    }
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const completeness = useMemo(() => {
    const fields = [form.full_name, form.gender, form.mobile, form.avatar_url];
    const done = fields.filter((v) => (v || "").toString().trim()).length;
    return Math.round((done / fields.length) * 100);
  }, [form]);

  const initial = (form.full_name || user?.email || "?").trim()[0]?.toUpperCase() || "?";

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 700 * 1024) { toast.error("Image too large — please use one under 700KB"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, avatar_url: reader.result }));
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const err = {};
    if (!isValidMobile(form.mobile)) err.mobile = "Enter a valid 10-digit Indian mobile number";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    setBusy(true);
    const res = await updateProfile({
      full_name: form.full_name.trim() || null,
      gender: form.gender || null,
      mobile: form.mobile ? normalizeMobile(form.mobile) : null,
      avatar_url: form.avatar_url || null,
    });
    setBusy(false);
    if (res.ok) toast.success("Profile updated");
    else setServerError(res.error || "Could not update your profile");
  };

  const inputCls = "focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground";

  if (!ready || !isAuthed) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" data-testid="page-profile">
      <span className="text-xs font-600 uppercase tracking-widest text-gold">Your account</span>
      <h1 className="mt-2 font-display text-4xl font-600 text-ink sm:text-5xl">Profile</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-muted">
        View and complete your profile. We only store basic contact details — never any card,
        bank or payment information.
      </p>

      {/* Completeness */}
      <div className="surface mt-6 rounded-2xl p-5" data-testid="profile-completeness">
        <div className="flex items-center justify-between text-sm">
          <span className="font-600 text-ink">Profile completeness</span>
          <span className="text-gold">{completeness}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-border bg-surface">
          <div className="h-full btn-gold transition-all" style={{ width: `${completeness}%` }} />
        </div>
      </div>

      <div className="surface mt-6 rounded-2xl p-6 sm:p-7">
        <form onSubmit={submit} className="space-y-6" noValidate>
          {/* Avatar */}
          <div className="flex items-center gap-4">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Your profile" referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-full object-cover" data-testid="profile-avatar-preview" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full btn-gold font-display text-2xl font-700"
                data-testid="profile-avatar-initial">{initial}</span>
            )}
            <div className="space-y-2">
              <button type="button" onClick={() => fileRef.current?.click()} data-testid="profile-avatar-upload"
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-ink-muted hover:text-gold">
                <Camera className="h-4 w-4 text-gold" /> Upload image
              </button>
              {form.avatar_url && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, avatar_url: "" }))}
                  data-testid="profile-avatar-remove"
                  className="ml-2 text-xs text-ink-muted underline hover:text-destructive">Remove</button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Full name</label>
            <input value={form.full_name} onChange={set("full_name")} data-testid="profile-name-input"
              placeholder="Your name" className={inputCls} />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Gender</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2" role="radiogroup" data-testid="profile-gender">
              {GENDERS.map(([val, label]) => (
                <label key={val} className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="radio" name="gender" value={val} checked={form.gender === val}
                    onChange={set("gender")} data-testid={`profile-gender-${val}`}
                    className="h-4 w-4 accent-[var(--gold,#d4af37)]" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Mobile</label>
            <input value={form.mobile} onChange={set("mobile")} inputMode="numeric" data-testid="profile-mobile-input"
              placeholder="10-digit mobile" className={inputCls} />
            {errors.mobile && <p className="mt-1 text-xs text-destructive" data-testid="profile-mobile-error">{errors.mobile}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Email</label>
            <input value={user?.email || ""} readOnly disabled data-testid="profile-email-input"
              className={`${inputCls} cursor-not-allowed opacity-70`} />
            <p className="mt-1 text-xs text-ink-muted">Email is used to sign in and can't be changed here.</p>
          </div>

          {serverError && <p className="text-sm text-destructive" data-testid="profile-error">{serverError}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} data-testid="profile-save-button"
              className="btn-gold focus-ring inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-700 disabled:opacity-60">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><CheckCircle2 className="h-4 w-4" /> Save profile</>}
            </button>
            <Link to="/account/cards" data-testid="profile-my-cards-link"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm text-ink-muted hover:text-gold">
              <CreditCard className="h-4 w-4 text-gold" /> My Cards
            </Link>
          </div>
        </form>
      </div>

      <div className="mt-6 flex items-start gap-2 text-xs text-ink-muted" data-testid="profile-privacy-note">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <span>
          YuktiCart never asks for or stores card numbers, CVV, expiry, PINs or any financial
          credentials on your profile. Manage your saved card <em>types</em> for offer matching under{" "}
          <Link to="/account/cards" className="gold-text hover:underline">My Cards</Link>.
        </span>
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-sm text-ink-muted">
        <UserRound className="h-4 w-4 text-gold" /> Signed in as {user?.email}
      </p>
    </div>
  );
}
