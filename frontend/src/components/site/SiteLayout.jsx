import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { AabharMandir } from "@/components/site/AabharMandir";
import { FirstLoadTransition } from "@/components/site/FirstLoadTransition";
import { DesignSelector } from "@/components/site/DesignSelector";
import { useTheme } from "@/context/ThemeContext";

export const MandirContext = React.createContext(() => {});

export default function SiteLayout() {
  const [mandirOpen, setMandirOpen] = useState(false);
  const { chosen } = useTheme();

  return (
    <MandirContext.Provider value={() => setMandirOpen(true)}>
      <FirstLoadTransition />
      {!chosen && <DesignSelector />}
      <div className="flex min-h-screen flex-col">
        <Nav onOpenMandir={() => setMandirOpen(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <AabharMandir open={mandirOpen} onClose={() => setMandirOpen(false)} />
    </MandirContext.Provider>
  );
}
