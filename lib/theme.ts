import { apiClient } from './api';

export type CustomThemeId = `custom-${string}`;

export type ThemeId = 'default' | 'neofi' | 'dark' | 'eco' | 'terminal' | CustomThemeId;

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  performanceScore: number;
  previewColors: string[];
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'default',
    name: 'Classic Blue',
    description: 'Standard professional interface with balanced contrast.',
    performanceScore: 90,
    previewColors: ['#2563eb', '#f8fafc', '#0f172a']
  },
  {
    id: 'neofi',
    name: 'NeoFi Desktop',
    description: 'Light desktop-style admin with flat sidebar and soft cards.',
    performanceScore: 88,
    previewColors: ['#f3f4f6', '#ffffff', '#0f172a']
  },
  {
    id: 'dark',
    name: 'Midnight',
    description: 'High contrast dark mode, optimized for OLED and low light.',
    performanceScore: 92,
    previewColors: ['#1e293b', '#0f172a', '#38bdf8']
  },
  {
    id: 'eco',
    name: 'Eco Saver',
    description: 'Soft natural tones with reduced blue light emission.',
    performanceScore: 95,
    previewColors: ['#166534', '#f0fdf4', '#14532d']
  },
  {
    id: 'terminal',
    name: 'System Terminal',
    description: 'Ultra-lightweight, no gradients, minimal rendering cost.',
    performanceScore: 100,
    previewColors: ['#000000', '#22c55e', '#000000']
  }
];

export const ADMIN_THEME_KEY = 'ajc_pisowifi_theme';
export const CUSTOM_THEMES_KEY = 'ajc_pisowifi_custom_themes';
export const PORTAL_CONFIG_KEY = 'ajc_portal_config';

export interface CustomThemeValues {
  primary: string;
  primaryDark: string;
  bg: string;
  bgCard: string;
  textMain: string;
  textMuted: string;
  border: string;
  sidebarBg?: string;
  sidebarText?: string;
}

export interface StoredCustomTheme {
  id: CustomThemeId;
  name: string;
  values: CustomThemeValues;
}

export function getCustomThemes(): StoredCustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredCustomTheme[];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: StoredCustomTheme[]) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  apiClient.saveCustomThemes(themes).catch(e => console.error('Failed to sync custom themes:', e));
}

function applyCustomThemeValues(values: CustomThemeValues) {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--primary', values.primary);
  rootStyle.setProperty('--primary-dark', values.primaryDark);
  rootStyle.setProperty('--bg', values.bg);
  rootStyle.setProperty('--bg-card', values.bgCard);
  rootStyle.setProperty('--text-main', values.textMain);
  rootStyle.setProperty('--text-muted', values.textMuted);
  rootStyle.setProperty('--border', values.border);
  if (values.sidebarBg) {
    rootStyle.setProperty('--sidebar-bg', values.sidebarBg);
  } else {
    rootStyle.removeProperty('--sidebar-bg');
  }
   if (values.sidebarText) {
    rootStyle.setProperty('--sidebar-text', values.sidebarText);
  } else {
    rootStyle.removeProperty('--sidebar-text');
  }
}

function clearCustomThemeValues() {
  const rootStyle = document.documentElement.style;
  rootStyle.removeProperty('--primary');
  rootStyle.removeProperty('--primary-dark');
  rootStyle.removeProperty('--bg');
  rootStyle.removeProperty('--bg-card');
  rootStyle.removeProperty('--text-main');
  rootStyle.removeProperty('--text-muted');
  rootStyle.removeProperty('--border');
  rootStyle.removeProperty('--sidebar-bg');
  rootStyle.removeProperty('--sidebar-text');
}

export interface PortalConfig {
  title: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  customCss?: string;
  customHtmlTop?: string;
  customHtmlBottom?: string;
  insertCoinAudio?: string;
  coinDropAudio?: string;
  connectedAudio?: string;
  macSyncEnabled: boolean;
  macSyncMode: 'fingerprint_mac' | 'session_token_mac';
}

export const DEFAULT_PORTAL_CONFIG: PortalConfig = {
  title: 'AJC PISOWIFI',
  subtitle: 'Enterprise Internet Gateway',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  backgroundColor: '#f8fafc',
  textColor: '#0f172a',
  customCss: '',
  customHtmlTop: '',
  customHtmlBottom: '',
  insertCoinAudio: '',
  coinDropAudio: '',
  connectedAudio: '',
  macSyncEnabled: false,
  macSyncMode: 'session_token_mac'
};

// --- Admin Theme Utilities ---

export function getStoredAdminTheme(): ThemeId {
  const stored = localStorage.getItem(ADMIN_THEME_KEY);
  return (stored as ThemeId) || 'default';
}

export function applyAdminTheme(themeId: ThemeId) {
  localStorage.setItem(ADMIN_THEME_KEY, themeId);
  const isCustom = typeof themeId === 'string' && themeId.startsWith('custom-');
  const baseTheme = isCustom ? 'default' : themeId;
  document.documentElement.setAttribute('data-theme', baseTheme);
  if (isCustom) {
    const custom = getCustomThemes().find(t => t.id === themeId);
    if (custom) {
      applyCustomThemeValues(custom.values);
    }
  } else {
    clearCustomThemeValues();
  }
}

export function setAdminTheme(themeId: ThemeId) {
  applyAdminTheme(themeId);
  apiClient.saveAdminTheme(themeId).catch(e => console.error('Failed to sync admin theme:', e));
}

export async function initAdminTheme() {
  const localTheme = getStoredAdminTheme();
  applyAdminTheme(localTheme);

  try {
    const [remoteTheme, remoteCustomThemes] = await Promise.all([
      apiClient.getAdminTheme(),
      apiClient.getCustomThemes()
    ]);

    if (remoteCustomThemes && Array.isArray(remoteCustomThemes)) {
       localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(remoteCustomThemes));
    }

    if (remoteTheme && remoteTheme !== localTheme) {
      applyAdminTheme(remoteTheme as ThemeId);
    }
  } catch (e) {
    // console.error('Failed to sync theme from server:', e);
  }
}

// --- Portal Config Utilities ---

export function getPortalConfig(): PortalConfig {
  try {
    const stored = localStorage.getItem(PORTAL_CONFIG_KEY);
    return stored ? { ...DEFAULT_PORTAL_CONFIG, ...JSON.parse(stored) } : DEFAULT_PORTAL_CONFIG;
  } catch (e) {
    return DEFAULT_PORTAL_CONFIG;
  }
}

export function setPortalConfig(config: PortalConfig) {
  localStorage.setItem(PORTAL_CONFIG_KEY, JSON.stringify(config));
}

export async function fetchPortalConfig(): Promise<PortalConfig> {
  try {
    const remote = await apiClient.getPortalConfig();
    if (remote && Object.keys(remote).length > 0) {
        const merged = { ...DEFAULT_PORTAL_CONFIG, ...remote };
        setPortalConfig(merged);
        return merged;
    }
    return getPortalConfig();
  } catch (e) {
    console.error('Failed to fetch portal config from server, using local', e);
    return getPortalConfig();
  }
}

export async function savePortalConfigRemote(config: PortalConfig) {
  setPortalConfig(config);
  await apiClient.savePortalConfig(config);
}

// Helper to apply portal config to CSS variables (if we decide to use them for portal too)
// For now, the Portal component will read this directly.
export function initTheme() {
  initAdminTheme();
}
