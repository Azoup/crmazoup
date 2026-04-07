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

// CSS variable definitions per theme
const THEME_VARS: Record<ColorTheme, Record<string, string>> = {
  default: {
    '--primary': '24 90% 50%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '24 80% 95%',
    '--accent-foreground': '24 80% 28%',
    '--ring': '24 90% 50%',
    '--sidebar-primary': '24 90% 50%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '24 80% 95%',
    '--sidebar-accent-foreground': '24 80% 28%',
    '--sidebar-ring': '24 90% 50%',
    '--gradient-start': '24 90% 50%',
    '--gradient-end': '24 90% 50%',
  },
  petroleo: {
    '--primary': '192 80% 30%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '192 70% 93%',
    '--accent-foreground': '192 70% 22%',
    '--ring': '192 80% 30%',
    '--sidebar-primary': '192 80% 30%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '192 70% 93%',
    '--sidebar-accent-foreground': '192 70% 22%',
    '--sidebar-ring': '192 80% 30%',
    '--gradient-start': '192 80% 30%',
    '--gradient-end': '192 80% 30%',
  },
  grafite: {
    '--primary': '215 20% 35%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '215 20% 94%',
    '--accent-foreground': '215 20% 20%',
    '--ring': '215 20% 35%',
    '--sidebar-primary': '215 20% 35%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '215 20% 94%',
    '--sidebar-accent-foreground': '215 20% 20%',
    '--sidebar-ring': '215 20% 35%',
    '--gradient-start': '215 20% 35%',
    '--gradient-end': '215 20% 35%',
  },
  vinho: {
    '--primary': '340 82% 35%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '340 70% 94%',
    '--accent-foreground': '340 70% 22%',
    '--ring': '340 82% 35%',
    '--sidebar-primary': '340 82% 35%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '340 70% 94%',
    '--sidebar-accent-foreground': '340 70% 22%',
    '--sidebar-ring': '340 82% 35%',
    '--gradient-start': '340 82% 35%',
    '--gradient-end': '340 82% 35%',
  },
  esmeralda: {
    '--primary': '160 84% 30%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '160 70% 93%',
    '--accent-foreground': '160 70% 18%',
    '--ring': '160 84% 30%',
    '--sidebar-primary': '160 84% 30%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '160 70% 93%',
    '--sidebar-accent-foreground': '160 70% 18%',
    '--sidebar-ring': '160 84% 30%',
    '--gradient-start': '160 84% 30%',
    '--gradient-end': '160 84% 30%',
  },
  'laranja-petroleo': {
    '--primary': '24 90% 50%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '192 70% 93%',
    '--accent-foreground': '192 70% 22%',
    '--ring': '24 90% 50%',
    '--sidebar-primary': '192 80% 30%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '24 80% 95%',
    '--sidebar-accent-foreground': '24 80% 28%',
    '--sidebar-ring': '192 80% 30%',
    '--gradient-start': '24 90% 50%',
    '--gradient-end': '192 80% 30%',
  },
  'laranja-grafite': {
    '--primary': '24 90% 50%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '215 20% 94%',
    '--accent-foreground': '215 20% 20%',
    '--ring': '24 90% 50%',
    '--sidebar-primary': '215 20% 35%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '24 80% 95%',
    '--sidebar-accent-foreground': '24 80% 28%',
    '--sidebar-ring': '215 20% 35%',
    '--gradient-start': '24 90% 50%',
    '--gradient-end': '215 20% 35%',
  },
  'laranja-vinho': {
    '--primary': '24 90% 50%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '340 70% 94%',
    '--accent-foreground': '340 70% 22%',
    '--ring': '24 90% 50%',
    '--sidebar-primary': '340 82% 35%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '24 80% 95%',
    '--sidebar-accent-foreground': '24 80% 28%',
    '--sidebar-ring': '340 82% 35%',
    '--gradient-start': '24 90% 50%',
    '--gradient-end': '340 82% 35%',
  },
  'laranja-esmeralda': {
    '--primary': '24 90% 50%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '160 70% 93%',
    '--accent-foreground': '160 70% 18%',
    '--ring': '24 90% 50%',
    '--sidebar-primary': '160 84% 30%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '24 80% 95%',
    '--sidebar-accent-foreground': '24 80% 28%',
    '--sidebar-ring': '160 84% 30%',
    '--gradient-start': '24 90% 50%',
    '--gradient-end': '160 84% 30%',
  },
  'petroleo-laranja': {
    '--primary': '192 80% 30%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '24 80% 95%',
    '--accent-foreground': '24 80% 28%',
    '--ring': '192 80% 30%',
    '--sidebar-primary': '24 90% 50%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '192 70% 93%',
    '--sidebar-accent-foreground': '192 70% 22%',
    '--sidebar-ring': '24 90% 50%',
    '--gradient-start': '192 80% 30%',
    '--gradient-end': '24 90% 50%',
  },
  'vinho-dourado': {
    '--primary': '340 82% 35%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '45 90% 92%',
    '--accent-foreground': '45 80% 25%',
    '--ring': '340 82% 35%',
    '--sidebar-primary': '45 85% 45%',
    '--sidebar-primary-foreground': '0 0% 10%',
    '--sidebar-accent': '340 70% 94%',
    '--sidebar-accent-foreground': '340 70% 22%',
    '--sidebar-ring': '45 85% 45%',
    '--gradient-start': '340 82% 35%',
    '--gradient-end': '45 85% 45%',
  },
  'azul-royal': {
    '--primary': '224 76% 40%',
    '--primary-foreground': '0 0% 100%',
    '--accent': '224 60% 94%',
    '--accent-foreground': '224 60% 22%',
    '--ring': '224 76% 40%',
    '--sidebar-primary': '224 76% 40%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '224 60% 94%',
    '--sidebar-accent-foreground': '224 60% 22%',
    '--sidebar-ring': '224 76% 40%',
    '--gradient-start': '224 76% 40%',
    '--gradient-end': '250 70% 50%',
  },
  midnight: {
    '--primary': '217 33% 22%',
    '--primary-foreground': '210 40% 98%',
    '--accent': '217 30% 90%',
    '--accent-foreground': '217 30% 18%',
    '--ring': '217 33% 22%',
    '--sidebar-primary': '217 33% 22%',
    '--sidebar-primary-foreground': '210 40% 98%',
    '--sidebar-accent': '217 30% 90%',
    '--sidebar-accent-foreground': '217 30% 18%',
    '--sidebar-ring': '217 33% 22%',
    '--gradient-start': '217 33% 22%',
    '--gradient-end': '220 40% 35%',
  },
};

// Dark mode accent overrides
const DARK_ACCENT_VARS: Record<string, Record<string, string>> = {
  default: { '--accent': '24 80% 20%', '--accent-foreground': '24 80% 90%' },
  petroleo: { '--accent': '192 50% 18%', '--accent-foreground': '192 70% 85%' },
  grafite: { '--accent': '215 20% 18%', '--accent-foreground': '215 20% 85%' },
  vinho: { '--accent': '340 50% 18%', '--accent-foreground': '340 70% 85%' },
  esmeralda: { '--accent': '160 50% 16%', '--accent-foreground': '160 70% 85%' },
  'laranja-petroleo': { '--accent': '192 50% 18%', '--accent-foreground': '192 70% 85%' },
  'laranja-grafite': { '--accent': '215 20% 18%', '--accent-foreground': '215 20% 85%' },
  'laranja-vinho': { '--accent': '340 50% 18%', '--accent-foreground': '340 70% 85%' },
  'laranja-esmeralda': { '--accent': '160 50% 16%', '--accent-foreground': '160 70% 85%' },
  'petroleo-laranja': { '--accent': '24 80% 20%', '--accent-foreground': '24 80% 90%' },
  'vinho-dourado': { '--accent': '45 50% 18%', '--accent-foreground': '45 70% 85%' },
  'azul-royal': { '--accent': '224 50% 18%', '--accent-foreground': '224 60% 85%' },
  midnight: { '--accent': '217 30% 16%', '--accent-foreground': '217 30% 85%' },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('azoup-dark-mode');
    return saved === 'true';
  });

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    return (localStorage.getItem('azoup-color-theme') as ColorTheme) || 'default';
  });

  // Apply dark mode class
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('azoup-dark-mode', String(darkMode));
  }, [darkMode]);

  // Apply theme via inline CSS variables on :root — guaranteed to work
  useEffect(() => {
    const root = document.documentElement;
    const vars = THEME_VARS[colorTheme] || THEME_VARS.default;
    
    // Set all theme variables directly
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Apply dark accent overrides if in dark mode
    if (darkMode && DARK_ACCENT_VARS[colorTheme]) {
      Object.entries(DARK_ACCENT_VARS[colorTheme]).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
    
    localStorage.setItem('azoup-color-theme', colorTheme);
  }, [colorTheme, darkMode]);

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
