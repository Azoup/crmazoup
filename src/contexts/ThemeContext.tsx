import React, { createContext, useContext, useEffect, useState } from 'react';

export type ColorTheme = 'default' | 'petroleo' | 'grafite' | 'vinho' | 'esmeralda';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const COLOR_THEMES: Record<ColorTheme, { label: string; accent: string; preview: string }> = {
  default: { label: 'Laranja Clássico', accent: '#e8730c', preview: '#e8730c' },
  petroleo: { label: 'Azul Petróleo', accent: '#0e7490', preview: '#0e7490' },
  grafite: { label: 'Cinza Grafite', accent: '#475569', preview: '#475569' },
  vinho: { label: 'Vinho/Bordô', accent: '#9f1239', preview: '#9f1239' },
  esmeralda: { label: 'Verde Esmeralda', accent: '#059669', preview: '#059669' },
};

export { COLOR_THEMES };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('azoup-dark-mode');
    return saved === 'true';
  });

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    return (localStorage.getItem('azoup-color-theme') as ColorTheme) || 'default';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('azoup-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove('theme-default', 'theme-petroleo', 'theme-grafite', 'theme-vinho', 'theme-esmeralda');
    root.classList.add(`theme-${colorTheme}`);
    localStorage.setItem('azoup-color-theme', colorTheme);
  }, [colorTheme]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);
  const setColorTheme = (theme: ColorTheme) => setColorThemeState(theme);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
