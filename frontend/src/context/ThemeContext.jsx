import React, { createContext, useContext, useEffect, useState } from "react";

const THEMES = {
  gold: {
    id: "gold",
    name: "Black & Gold",
    tag: "Recommended",
    desc: "Deep black with refined gold accents. Premium Indian fintech luxury.",
    swatch: ["#0a0a0b", "#d4af37", "#f5f1e8"],
  },
  obsidian: {
    id: "obsidian",
    name: "Cyber Obsidian",
    tag: "Data-heavy",
    desc: "Near-black obsidian with electric cyan actions and gold gratitude accents.",
    swatch: ["#060809", "#22d3ee", "#e8c766"],
  },
  editorial: {
    id: "editorial",
    name: "Light Editorial",
    tag: "Bright",
    desc: "Clean neutral canvas, ink typography and emerald savings indicators.",
    swatch: ["#f7f6f2", "#0f9d6a", "#14110c"],
  },
};

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);
export { THEMES };

export function ThemeProvider({ children }) {
  // Default theme: the existing SECOND theme ("obsidian" / Cyber Obsidian).
  // Returning visitors keep their previously stored preference (existing
  // localStorage persistence reused unchanged).
  
  const [theme, setThemeState] = useState(() => localStorage.getItem("yc_theme") || "gold");

  // Startup never auto-shows the theme selector: users enter the app directly
  // after the loading animation. The palette button (reopenSelector) still
  // opens the selector on demand, and confirmChoice still persists choices.
  const [chosen, setChosen] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = (id) => {
    setThemeState(id);
    localStorage.setItem("yc_theme", id);
  };
  const confirmChoice = (id) => {
    setTheme(id);
    setChosen(true);
    localStorage.setItem("yc_theme_chosen", "1");
  };
  const reopenSelector = () => {
    setChosen(false);
    localStorage.removeItem("yc_theme_chosen");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, chosen, confirmChoice, reopenSelector, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
