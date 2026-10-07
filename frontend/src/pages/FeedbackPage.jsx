import React, { useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";

const CONFIG = {
  contact: { title: "Contact Us", kicker: "Company", desc: "Questions, partnerships or press — reach out and we'll reply to your email.", label: "Your message" },
  report_rate: { title: "Report an Incorrect Rate", kicker: "Help", desc: "Spotted a wrong cashback or gift-card rate? Tell us the store, category and what you saw.", label: "What's incorrect?" },
  suggest_store: { title: "Suggest a Store or Platform", kicker: "Help", desc: "Want us to add a store, affiliate or gift-card platform? Suggest it here.", label: "Store / platform details" },
};

export function FeedbackPage({ kind }) {
  const cfg = CONFIG[kind];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) { toast.error("Please add a message"); return; }
    try {
      await api.post("/feedback", { kind, name, email: email || undefined, message });
      setSent(true); setMessage(""); setName(""); setEmail("");
      toast.success("Thank you — we've received your message.");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <PageShell title={cfg.title} kicker={cfg.kicker} description={cfg.desc}>
      {kind === "contact" && (
        <a href="mailto:yukticart@gmail.com" data-testid="contact-email-link"
          className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
          <Mail className="h-4 w-4" /> yukticart@gmail.com
        </a>
      )}
      {sent ? (
        <div className="surface rounded-xl p-6 text-center" data-testid="feedback-success">
          <p className="text-savings">Received! We'll get back to you at the email you provided.</p>
          <button onClick={() => setSent(false)} className="mt-3 text-sm text-gold hover:underline">Send another</button>
        </div>
      ) : (
        <form onSubmit={submit} className="surface space-y-4 rounded-xl p-6" data-testid="feedback-form">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} data-testid="feedback-name"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="feedback-email"
                className="focus-ring h-11 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-600 uppercase tracking-wide text-ink-muted">{cfg.label}</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} data-testid="feedback-message"
              className="focus-ring w-full rounded-md border border-border bg-input p-3 text-sm text-foreground" />
          </div>
          <button type="submit" data-testid="feedback-submit"
            className="btn-gold focus-ring inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-700">
            <Send className="h-4 w-4" /> Send message
          </button>
        </form>
      )}
    </PageShell>
  );
}
