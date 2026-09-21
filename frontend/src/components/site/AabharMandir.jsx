import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Bell, Undo2, Flame } from "lucide-react";
import { api } from "@/lib/api";
import { MASCOTS } from "@/lib/assets";

const BLESSINGS = [
  "May your carts stay light and your savings heavy.",
  "Gratitude turns what we have into enough.",
  "A mindful rupee saved is a rupee earned twice.",
  "May every purchase be wise and every deal be kind.",
  "Abundance flows to those who shop with intention.",
];

function ringBell() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Temple bell: fundamental + inharmonic partials, long decay
    const partials = [1, 2.7, 4.2, 5.4];
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    master.connect(ctx.destination);
    partials.forEach((p, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 320 * p;
      g.gain.setValueAtTime(1 / (i + 1.5), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.8 - i * 0.3);
      osc.connect(g); g.connect(master);
      osc.start(now); osc.stop(now + 3.2);
    });
    setTimeout(() => ctx.close(), 3600);
  } catch { /* audio unavailable */ }
}

function PetalRain({ active, reduce }) {
  if (!active) return null;
  if (reduce) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-10 opacity-40" aria-hidden>
        <span className="text-gold">🌼 gentle blessings 🌼</span>
      </div>
    );
  }
  const petals = Array.from({ length: 26 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-testid="petal-rain">
      {petals.map((_, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${(i * 3.8) % 100}%`,
            animation: `petal-fall ${4 + (i % 5)}s linear ${(i % 7) * 0.4}s infinite`,
            fontSize: `${12 + (i % 4) * 4}px`,
          }}
        >
          {i % 2 ? "🌸" : "🌼"}
        </span>
      ))}
    </div>
  );
}

export function AabharMandir({ open, onClose }) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(0);
  const [rained, setRained] = useState(false);
  const [blessing, setBlessing] = useState(0);
  const [msg, setMsg] = useState("");
  const [rang, setRang] = useState(false);
  const keyRef = useRef(null);
  const cooldown = useRef(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/gratitude"); setCount(data.count); } catch {}
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const iv = setInterval(() => setBlessing((b) => (b + 1) % BLESSINGS.length), 4000);
    return () => { window.removeEventListener("keydown", onKey); clearInterval(iv); };
  }, [open, onClose]);

  const doRing = async () => {
    if (cooldown.current || rang) return;
    cooldown.current = true;
    setTimeout(() => (cooldown.current = false), 800);
    ringBell();
    const key = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
    keyRef.current = key;
    setRang(true);
    setRained(true); // flower rain starts automatically
    setMsg("Bell rung — blessings in bloom.");
    try {
      const { data } = await api.post("/gratitude/ring", { idempotency_key: key });
      setCount(data.count);
    } catch { setMsg("Bell rung locally (offline)."); }
  };

  const doUndo = async () => {
    if (!keyRef.current || !rang) return;
    setRang(false);
    setRained(false); // settle the rain
    setMsg("Your last ring was reverted.");
    try {
      const { data } = await api.post("/gratitude/undo", { idempotency_key: keyRef.current });
      setCount(data.count);
    } catch {}
    keyRef.current = null;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[65] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          data-testid="aabhar-mandir"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gold/30 bg-[#0a0a0b] p-6 text-center"
            style={{ boxShadow: "0 0 80px var(--glow)" }}
          >
            <PetalRain active={rained} reduce={reduce} />
            <button
              onClick={onClose} data-testid="mandir-close" aria-label="Close"
              className="focus-ring absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-gold/30 text-gold"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative z-[1]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1 text-xs text-gold">
                <Flame className="h-3.5 w-3.5" /> Aabhar Mandir
              </span>
              <h3 className="mt-4 font-display text-2xl font-600 text-[#f5f1e8]">A moment of gratitude</h3>

              <div className="relative mx-auto mt-5 h-40 w-40">
                <img src={MASCOTS.diya} alt="A glowing brass diya lamp in a dark temple"
                     className={`h-full w-full rounded-full object-cover ${rang ? "flame" : ""}`} />
              </div>

              <p className="mt-5 min-h-[2.5rem] text-sm italic text-[#d8c9a3]" data-testid="mandir-blessing">
                “{BLESSINGS[blessing]}”
              </p>

              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[#a8a29e]">
                <Bell className="h-4 w-4 text-gold" />
                <span data-testid="mandir-count">
                  <strong className="text-gold">{count.toLocaleString("en-IN")}</strong> gratitude bells rung
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#7d766c]">Counted globally on the server.</p>

              {msg && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gold" data-testid="mandir-msg">
                  <img src={rang ? MASCOTS.joyful : MASCOTS.sad} alt="" className="h-6 w-6 rounded-full object-cover" />
                  {msg}
                </div>
              )}

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={doRing} disabled={rang} data-testid="mandir-ring"
                  className="btn-gold focus-ring flex items-center gap-2 rounded-full px-6 py-3 text-sm font-700 disabled:opacity-50"
                >
                  <Bell className="h-4 w-4" /> Ring the bell
                </button>
                {rang && (
                  <button
                    onClick={doUndo} data-testid="mandir-undo"
                    className="focus-ring flex items-center gap-2 rounded-full border border-gold/40 px-4 py-3 text-sm text-gold"
                  >
                    <Undo2 className="h-4 w-4" /> Undo
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
