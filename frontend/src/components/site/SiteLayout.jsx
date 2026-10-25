import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { AabharMandir } from "@/components/site/AabharMandir";
import { DesignSelector } from "@/components/site/DesignSelector";
import { WelcomeGuide } from "@/components/site/WelcomeGuide";
import { useTheme } from "@/context/ThemeContext";

export const MandirContext = React.createContext(() => {});

// Reused (not a new mechanism) — same localStorage persistence pattern as
// ThemeContext's "yc_theme_chosen" flag, scoped to this one onboarding popup.
const WELCOME_SEEN_KEY = "yc_welcome_seen";

export default function SiteLayout() {
  const [mandirOpen, setMandirOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const { chosen } = useTheme();

  // First-time visitors only: shown once per browser the first time this
  // layout mounts (any shopper-facing page), independent of auth/theme
  // state. Returning visitors (flag already set) never see it automatically
  // — they can still reopen the identical guide anytime from the nav.
  useEffect(() => {
    if (!localStorage.getItem(WELCOME_SEEN_KEY)) setGuideOpen(true);
  }, []);

  const handleGuideOpenChange = (next) => {
    setGuideOpen(next);
    if (!next) localStorage.setItem(WELCOME_SEEN_KEY, "1");
  };

  return (
    <MandirContext.Provider value={() => setMandirOpen(true)}>
      {!chosen && <DesignSelector />}
      <div className="flex min-h-screen flex-col">
        <Nav onOpenMandir={() => setMandirOpen(true)} onOpenGuide={() => setGuideOpen(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <AabharMandir open={mandirOpen} onClose={() => setMandirOpen(false)} />
      <WelcomeGuide open={guideOpen} onOpenChange={handleGuideOpenChange} />
    </MandirContext.Provider>
  );
}
