import React, { createContext, useContext, useEffect, useState } from 'react';

export type ColorTheme = 
  | 'default' | 'petroleo' | 'grafite' | 'vinho' | 'esmeralda'
  | 'laranja-petroleo' | 'laranja-grafite' | 'laranja-vinho' | 'laranja-esmeralda'
  | 'petroleo-laranja' | 'vinho-dourado' | 'azul-royal' | 'midnight'
  | 'coral' | 'oceano' | 'lavanda' | 'terracota' | 'turquesa'
  | 'dourado' | 'rosa-pink' | 'oliva' | 'cobre' | 'safira'
  | 'jade' | 'ametista' | 'ferrugem' | 'indigo' | 'menta'
  | 'carmesim' | 'bronze' | 'celeste' | 'magenta' | 'slate-blue';

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
  'coral': { label: 'Coral', preview: '#ef6461', group: 'single' },
  'oceano': { label: 'Oceano Profundo', preview: '#0077b6', group: 'single' },
  'lavanda': { label: 'Lavanda', preview: '#7c3aed', group: 'single' },
  'terracota': { label: 'Terracota', preview: '#c2452d', group: 'single' },
  'turquesa': { label: 'Turquesa', preview: '#0d9488', group: 'single' },
  'dourado': { label: 'Dourado', preview: '#b8860b', group: 'premium' },
  'rosa-pink': { label: 'Rosa Pink', preview: '#db2777', group: 'single' },
  'oliva': { label: 'Verde Oliva', preview: '#65782d', group: 'single' },
  'cobre': { label: 'Cobre', preview: '#b87333', group: 'premium' },
  'safira': { label: 'Safira', preview: '#2563eb', group: 'single' },
  'jade': { label: 'Jade', preview: '#00a86b', group: 'single' },
  'ametista': { label: 'Ametista', preview: '#9333ea', group: 'premium' },
  'ferrugem': { label: 'Ferrugem', preview: '#a0522d', group: 'single' },
  'indigo': { label: 'Índigo', preview: '#4f46e5', group: 'single' },
  'menta': { label: 'Menta', preview: '#2dd4bf', group: 'single' },
  'carmesim': { label: 'Carmesim', preview: '#dc143c', group: 'single' },
  'bronze': { label: 'Bronze', preview: '#8b6914', group: 'premium' },
  'celeste': { label: 'Celeste', preview: '#38bdf8', group: 'single' },
  'magenta': { label: 'Magenta', preview: '#c026d3', group: 'single' },
  'slate-blue': { label: 'Azul Ardósia', preview: '#6366f1', group: 'single' },
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
  coral: {
    '--primary': '1 80% 65%', '--primary-foreground': '0 0% 100%',
    '--accent': '1 70% 94%', '--accent-foreground': '1 70% 25%',
    '--ring': '1 80% 65%', '--sidebar-primary': '1 80% 65%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '1 70% 94%', '--sidebar-accent-foreground': '1 70% 25%', '--sidebar-ring': '1 80% 65%',
    '--gradient-start': '1 80% 65%', '--gradient-end': '15 80% 55%',
  },
  oceano: {
    '--primary': '201 90% 36%', '--primary-foreground': '0 0% 100%',
    '--accent': '201 70% 93%', '--accent-foreground': '201 70% 20%',
    '--ring': '201 90% 36%', '--sidebar-primary': '201 90% 36%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '201 70% 93%', '--sidebar-accent-foreground': '201 70% 20%', '--sidebar-ring': '201 90% 36%',
    '--gradient-start': '201 90% 36%', '--gradient-end': '210 80% 45%',
  },
  lavanda: {
    '--primary': '263 70% 50%', '--primary-foreground': '0 0% 100%',
    '--accent': '263 60% 94%', '--accent-foreground': '263 60% 22%',
    '--ring': '263 70% 50%', '--sidebar-primary': '263 70% 50%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '263 60% 94%', '--sidebar-accent-foreground': '263 60% 22%', '--sidebar-ring': '263 70% 50%',
    '--gradient-start': '263 70% 50%', '--gradient-end': '280 60% 55%',
  },
  terracota: {
    '--primary': '12 68% 47%', '--primary-foreground': '0 0% 100%',
    '--accent': '12 60% 94%', '--accent-foreground': '12 60% 22%',
    '--ring': '12 68% 47%', '--sidebar-primary': '12 68% 47%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '12 60% 94%', '--sidebar-accent-foreground': '12 60% 22%', '--sidebar-ring': '12 68% 47%',
    '--gradient-start': '12 68% 47%', '--gradient-end': '20 65% 40%',
  },
  turquesa: {
    '--primary': '174 60% 32%', '--primary-foreground': '0 0% 100%',
    '--accent': '174 50% 93%', '--accent-foreground': '174 50% 18%',
    '--ring': '174 60% 32%', '--sidebar-primary': '174 60% 32%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '174 50% 93%', '--sidebar-accent-foreground': '174 50% 18%', '--sidebar-ring': '174 60% 32%',
    '--gradient-start': '174 60% 32%', '--gradient-end': '180 55% 40%',
  },
  dourado: {
    '--primary': '43 80% 38%', '--primary-foreground': '0 0% 100%',
    '--accent': '43 70% 93%', '--accent-foreground': '43 70% 20%',
    '--ring': '43 80% 38%', '--sidebar-primary': '43 80% 38%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '43 70% 93%', '--sidebar-accent-foreground': '43 70% 20%', '--sidebar-ring': '43 80% 38%',
    '--gradient-start': '43 80% 38%', '--gradient-end': '38 75% 48%',
  },
  'rosa-pink': {
    '--primary': '330 80% 50%', '--primary-foreground': '0 0% 100%',
    '--accent': '330 70% 94%', '--accent-foreground': '330 70% 22%',
    '--ring': '330 80% 50%', '--sidebar-primary': '330 80% 50%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '330 70% 94%', '--sidebar-accent-foreground': '330 70% 22%', '--sidebar-ring': '330 80% 50%',
    '--gradient-start': '330 80% 50%', '--gradient-end': '345 75% 55%',
  },
  oliva: {
    '--primary': '76 55% 33%', '--primary-foreground': '0 0% 100%',
    '--accent': '76 45% 93%', '--accent-foreground': '76 45% 18%',
    '--ring': '76 55% 33%', '--sidebar-primary': '76 55% 33%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '76 45% 93%', '--sidebar-accent-foreground': '76 45% 18%', '--sidebar-ring': '76 55% 33%',
    '--gradient-start': '76 55% 33%', '--gradient-end': '85 50% 40%',
  },
  cobre: {
    '--primary': '29 55% 45%', '--primary-foreground': '0 0% 100%',
    '--accent': '29 45% 93%', '--accent-foreground': '29 45% 20%',
    '--ring': '29 55% 45%', '--sidebar-primary': '29 55% 45%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '29 45% 93%', '--sidebar-accent-foreground': '29 45% 20%', '--sidebar-ring': '29 55% 45%',
    '--gradient-start': '29 55% 45%', '--gradient-end': '20 50% 38%',
  },
  safira: {
    '--primary': '217 90% 53%', '--primary-foreground': '0 0% 100%',
    '--accent': '217 70% 94%', '--accent-foreground': '217 70% 22%',
    '--ring': '217 90% 53%', '--sidebar-primary': '217 90% 53%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '217 70% 94%', '--sidebar-accent-foreground': '217 70% 22%', '--sidebar-ring': '217 90% 53%',
    '--gradient-start': '217 90% 53%', '--gradient-end': '225 85% 60%',
  },
  jade: {
    '--primary': '155 100% 33%', '--primary-foreground': '0 0% 100%',
    '--accent': '155 70% 93%', '--accent-foreground': '155 70% 18%',
    '--ring': '155 100% 33%', '--sidebar-primary': '155 100% 33%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '155 70% 93%', '--sidebar-accent-foreground': '155 70% 18%', '--sidebar-ring': '155 100% 33%',
    '--gradient-start': '155 100% 33%', '--gradient-end': '160 90% 40%',
  },
  ametista: {
    '--primary': '271 81% 56%', '--primary-foreground': '0 0% 100%',
    '--accent': '271 60% 94%', '--accent-foreground': '271 60% 22%',
    '--ring': '271 81% 56%', '--sidebar-primary': '271 81% 56%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '271 60% 94%', '--sidebar-accent-foreground': '271 60% 22%', '--sidebar-ring': '271 81% 56%',
    '--gradient-start': '271 81% 56%', '--gradient-end': '280 75% 50%',
  },
  ferrugem: {
    '--primary': '19 55% 40%', '--primary-foreground': '0 0% 100%',
    '--accent': '19 45% 93%', '--accent-foreground': '19 45% 20%',
    '--ring': '19 55% 40%', '--sidebar-primary': '19 55% 40%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '19 45% 93%', '--sidebar-accent-foreground': '19 45% 20%', '--sidebar-ring': '19 55% 40%',
    '--gradient-start': '19 55% 40%', '--gradient-end': '25 50% 35%',
  },
  indigo: {
    '--primary': '239 84% 67%', '--primary-foreground': '0 0% 100%',
    '--accent': '239 60% 94%', '--accent-foreground': '239 60% 22%',
    '--ring': '239 84% 67%', '--sidebar-primary': '239 84% 67%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '239 60% 94%', '--sidebar-accent-foreground': '239 60% 22%', '--sidebar-ring': '239 84% 67%',
    '--gradient-start': '239 84% 67%', '--gradient-end': '245 80% 60%',
  },
  menta: {
    '--primary': '174 70% 49%', '--primary-foreground': '0 0% 10%',
    '--accent': '174 55% 92%', '--accent-foreground': '174 55% 18%',
    '--ring': '174 70% 49%', '--sidebar-primary': '174 70% 49%', '--sidebar-primary-foreground': '0 0% 10%',
    '--sidebar-accent': '174 55% 92%', '--sidebar-accent-foreground': '174 55% 18%', '--sidebar-ring': '174 70% 49%',
    '--gradient-start': '174 70% 49%', '--gradient-end': '168 65% 42%',
  },
  carmesim: {
    '--primary': '348 83% 47%', '--primary-foreground': '0 0% 100%',
    '--accent': '348 65% 94%', '--accent-foreground': '348 65% 22%',
    '--ring': '348 83% 47%', '--sidebar-primary': '348 83% 47%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '348 65% 94%', '--sidebar-accent-foreground': '348 65% 22%', '--sidebar-ring': '348 83% 47%',
    '--gradient-start': '348 83% 47%', '--gradient-end': '355 80% 55%',
  },
  bronze: {
    '--primary': '42 65% 30%', '--primary-foreground': '0 0% 100%',
    '--accent': '42 50% 93%', '--accent-foreground': '42 50% 18%',
    '--ring': '42 65% 30%', '--sidebar-primary': '42 65% 30%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '42 50% 93%', '--sidebar-accent-foreground': '42 50% 18%', '--sidebar-ring': '42 65% 30%',
    '--gradient-start': '42 65% 30%', '--gradient-end': '35 60% 38%',
  },
  celeste: {
    '--primary': '198 90% 60%', '--primary-foreground': '0 0% 10%',
    '--accent': '198 70% 93%', '--accent-foreground': '198 70% 20%',
    '--ring': '198 90% 60%', '--sidebar-primary': '198 90% 60%', '--sidebar-primary-foreground': '0 0% 10%',
    '--sidebar-accent': '198 70% 93%', '--sidebar-accent-foreground': '198 70% 20%', '--sidebar-ring': '198 90% 60%',
    '--gradient-start': '198 90% 60%', '--gradient-end': '205 85% 52%',
  },
  magenta: {
    '--primary': '293 70% 50%', '--primary-foreground': '0 0% 100%',
    '--accent': '293 55% 94%', '--accent-foreground': '293 55% 22%',
    '--ring': '293 70% 50%', '--sidebar-primary': '293 70% 50%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '293 55% 94%', '--sidebar-accent-foreground': '293 55% 22%', '--sidebar-ring': '293 70% 50%',
    '--gradient-start': '293 70% 50%', '--gradient-end': '300 65% 55%',
  },
  'slate-blue': {
    '--primary': '239 84% 67%', '--primary-foreground': '0 0% 100%',
    '--accent': '239 60% 94%', '--accent-foreground': '239 60% 22%',
    '--ring': '239 84% 67%', '--sidebar-primary': '239 84% 67%', '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '239 60% 94%', '--sidebar-accent-foreground': '239 60% 22%', '--sidebar-ring': '239 84% 67%',
    '--gradient-start': '239 84% 67%', '--gradient-end': '248 80% 60%',
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
  coral: { '--accent': '1 50% 18%', '--accent-foreground': '1 70% 85%' },
  oceano: { '--accent': '201 50% 18%', '--accent-foreground': '201 70% 85%' },
  lavanda: { '--accent': '263 50% 18%', '--accent-foreground': '263 60% 85%' },
  terracota: { '--accent': '12 50% 18%', '--accent-foreground': '12 60% 85%' },
  turquesa: { '--accent': '174 50% 16%', '--accent-foreground': '174 50% 85%' },
  dourado: { '--accent': '43 50% 18%', '--accent-foreground': '43 70% 85%' },
  'rosa-pink': { '--accent': '330 50% 18%', '--accent-foreground': '330 70% 85%' },
  oliva: { '--accent': '76 40% 16%', '--accent-foreground': '76 45% 85%' },
  cobre: { '--accent': '29 45% 18%', '--accent-foreground': '29 45% 85%' },
  safira: { '--accent': '217 60% 18%', '--accent-foreground': '217 70% 85%' },
  jade: { '--accent': '155 50% 16%', '--accent-foreground': '155 70% 85%' },
  ametista: { '--accent': '271 50% 18%', '--accent-foreground': '271 60% 85%' },
  ferrugem: { '--accent': '19 45% 18%', '--accent-foreground': '19 45% 85%' },
  indigo: { '--accent': '239 50% 18%', '--accent-foreground': '239 60% 85%' },
  menta: { '--accent': '174 50% 16%', '--accent-foreground': '174 55% 85%' },
  carmesim: { '--accent': '348 50% 18%', '--accent-foreground': '348 65% 85%' },
  bronze: { '--accent': '42 45% 16%', '--accent-foreground': '42 50% 85%' },
  celeste: { '--accent': '198 50% 18%', '--accent-foreground': '198 70% 85%' },
  magenta: { '--accent': '293 50% 18%', '--accent-foreground': '293 55% 85%' },
  'slate-blue': { '--accent': '239 50% 18%', '--accent-foreground': '239 60% 85%' },
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
