import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";
export type FontScale = "compact" | "default" | "comfortable" | "large";

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  fontScale: "default",
  setFontScale: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "rusttrack-theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved === "light" || saved === "dark" || saved === "system") return saved;
      } catch { /* Use the default when storage is unavailable. */ }
      return defaultTheme;
    }
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const preference = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        root.classList.toggle("dark", preference.matches);
        root.classList.toggle("light", !preference.matches);
      };
      apply();
      preference.addEventListener("change", apply);
      return () => preference.removeEventListener("change", apply);
    }

    root.classList.add(theme);
  }, [theme]);

  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    try {
      const saved = localStorage.getItem("kanbrix-font-scale");
      if (saved === "compact" || saved === "default" || saved === "comfortable" || saved === "large") {
        return saved;
      }
    } catch { /* Use default when storage is unavailable. */ }
    return "default";
  });

  useEffect(() => {
    window.document.documentElement.dataset.fontScale = fontScale;
  }, [fontScale]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      try { localStorage.setItem(storageKey, theme); } catch { /* Apply for this session. */ }
      setTheme(theme);
    },
    fontScale,
    setFontScale: (scale: FontScale) => {
      try { localStorage.setItem("kanbrix-font-scale", scale); } catch { /* Apply for this session. */ }
      setFontScaleState(scale);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
