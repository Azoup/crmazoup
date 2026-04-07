import React, { createContext, useContext, useEffect, useState } from 'react';

export type ColorTheme = 
  | 'default' | 'petroleo' | 'grafite' | 'vinho' | 'esmeralda'
  | 'laranja-petroleo' | 'laranja-grafite' | 'laranja-vinho' | 'laranja-esmeralda'
  | 'petroleo-laranja' | 'vinho-dourado' | 'azul-royal' | 'midnight';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeInfo {
  label: string;
  preview: string;
  preview2?: string;
  group: 'single' | 'combo' | 'premium';
}

const COLOR_THEMES: Record<ColorTheme, ThemeInfo> = {
  default: { label: 'Laranja Clássico', preview: '#e8730c', group: 'single' },
  petroleo: { label: 'Azul Petróleo', preview: '#0e7490', group: 'single' },
  grafite: { label: 'Cinza Grafite', preview: '#475569', group: 'single' },
  vinho: { label: 'Vinho/Bordô', preview: '#9f1239', group: 'single' },
  esmeralda: { label: 'Verde Esmeralda', preview: '#059669', group: 'single' },
  'laranja-petroleo': { label: 'Laranja + Petróleo', preview: '#e8730c', preview2: '#0e7490', group: 'combo' },
  'laranja-grafite': { label: 'Laranja + Grafite', preview: '#e8730c', preview2: '#475569', group: 'combo' },
  'laranja-vinho': { label: 'Laranja + Vinho', preview: '#e8730c', preview2: '#9f1239', group: 'combo' },
  'laranja-esmeralda': { label: 'Laranja + Esmeralda', preview: '#e8730c', preview2: '#059669', group: 'combo' },
  'petroleo-laranja': { label: 'Petróleo + Laranja', preview: '#0e7490', preview2: '#e8730c', group: 'combo' },
  'vinho-dourado': { label: 'Vinho + Dourado', preview: '#9f1239', preview2: '#d4a017', group: 'combo' },
  'azul-royal': { label: 'Azul Royal', preview: '#1e40af', group: 'premium' },
  'midnight': { label: 'Midnight Premium', preview: '#1e293b', group: 'premium' },
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
    // Remove all theme classes from both html and body
    const allThemes = Object.keys(COLOR_THEMES).map(k => `theme-${k}`);
    root.classList.remove(...allThemes);
    document.body.classList.remove(...allThemes);
    // Add to both html and body for maximum specificity
    root.classList.add(`theme-${colorTheme}`);
    document.body.classList.add(`theme-${colorTheme}`);
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
