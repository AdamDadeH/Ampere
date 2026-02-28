import { create } from 'zustand'
import { useMemo } from 'react'
import type { Theme, CompactSkin } from '../themes/types'
import { themesById, midnight } from '../themes/skins'

const STORAGE_KEY = 'ampere-theme'
const CUSTOM_SKIN_KEY = 'ampere-compact-skin'

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${key}`, value)
  }
  for (const [key, value] of Object.entries(theme.effects)) {
    root.style.setProperty(`--effect-${key}`, value)
  }
}

interface ThemeState {
  currentThemeId: string
  customCompactSkin: CompactSkin | null
  setTheme: (id: string) => void
  setCustomCompactSkin: (skin: CompactSkin | null) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  currentThemeId: 'midnight',
  customCompactSkin: null,
  setTheme: (id: string) => {
    const theme = themesById[id]
    if (!theme) return
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, id)
    set({ currentThemeId: id })
  },
  setCustomCompactSkin: (skin: CompactSkin | null) => {
    if (skin) {
      localStorage.setItem(CUSTOM_SKIN_KEY, JSON.stringify(skin))
    } else {
      localStorage.removeItem(CUSTOM_SKIN_KEY)
    }
    set({ customCompactSkin: skin })
  },
}))

// Cross-window sync: when another window changes the theme or custom skin in localStorage,
// this window picks it up via the 'storage' event.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      const theme = themesById[e.newValue]
      if (!theme) return
      applyTheme(theme)
      useThemeStore.setState({ currentThemeId: e.newValue })
    }
    if (e.key === CUSTOM_SKIN_KEY) {
      const skin = e.newValue ? JSON.parse(e.newValue) as CompactSkin : null
      useThemeStore.setState({ customCompactSkin: skin })
    }
  })
}

/** Hook that returns the CompactSkin for the current theme, or the custom skin if set */
export function useCompactSkin(): CompactSkin {
  const themeId = useThemeStore((s) => s.currentThemeId)
  const custom = useThemeStore((s) => s.customCompactSkin)
  return useMemo(() => {
    if (custom) return custom
    const theme = themesById[themeId]
    return theme ? theme.compact : midnight.compact
  }, [themeId, custom])
}

// Apply saved theme immediately at module load time (before React mounts)
const savedId = localStorage.getItem(STORAGE_KEY)
const initialTheme = (savedId && themesById[savedId]) ? themesById[savedId] : midnight
applyTheme(initialTheme)
if (savedId && themesById[savedId]) {
  useThemeStore.setState({ currentThemeId: savedId })
}

// Restore persisted custom compact skin
const savedSkinJson = localStorage.getItem(CUSTOM_SKIN_KEY)
if (savedSkinJson) {
  try {
    const savedSkin = JSON.parse(savedSkinJson) as CompactSkin
    useThemeStore.setState({ customCompactSkin: savedSkin })
  } catch {
    localStorage.removeItem(CUSTOM_SKIN_KEY)
  }
}
