export interface ThemeColors {
  'bg-primary': string
  'bg-secondary': string
  'bg-tertiary': string
  'bg-hover': string
  'bg-active': string
  'bg-highlight': string
  'text-primary': string
  'text-secondary': string
  'text-muted': string
  'text-faint': string
  accent: string
  'accent-hover': string
  'accent-text': string
  'accent-glow': string
  'border-primary': string
  'border-secondary': string
  'border-focus': string
  'scrollbar-track': string
  'scrollbar-thumb': string
  'scrollbar-thumb-hover': string
  'progress-bar': string
  'progress-hover': string
  'play-button-bg': string
  'play-button-fg': string
  'star-filled': string
  'star-empty': string
  'star-hover': string
}

export interface ThemeEffects {
  'shadow-glow': string
  'text-shadow': string
  'font-family': string
  'radius-sm': string
  'radius-md': string
  'radius-lg': string
}

export interface Theme {
  id: string
  name: string
  description: string
  colors: ThemeColors
  effects: ThemeEffects
  previewColors: [string, string, string, string, string]
  compact: CompactSkin
}

export type CompactButtonStyle = 'beveled' | 'flat' | 'pill'
export type CompactSpectrumStyle = 'bars' | 'mirrored' | 'dots' | 'waveform'

export interface CompactSkinSeed {
  shell: string
  display: string
  text: string
  accent: string
  style: CompactButtonStyle
  spectrum: CompactSpectrumStyle
  shellBackground?: string
  displayBackground?: string
}

export interface CompactSkin {
  shell: {
    background: string
    borderTop: string
    borderLeft: string
    borderRight: string
    borderBottom: string
    boxShadow: string
    borderRadius: string
    fontFamily: string
  }
  scanlines: string
  titlebar: {
    background: string
    borderBottom: string
    textColor: string
    textShadow: string
    buttonBg: string
    buttonBorderLight: string
    buttonBorderDark: string
    buttonIconColor: string
    closeHoverBg: string
  }
  display: {
    background: string
    borderTop: string
    borderLeft: string
    borderRight: string
    borderBottom: string
    boxShadow: string
    borderRadius: string
    scanlines: string
    textColor: string
    textShadow: string
    textDimColor: string
    textDimShadow: string
    fontFamily: string
  }
  spectrum: {
    barColor: string
    barColorRgb: [number, number, number]
    glowAlpha: number
    style: CompactSpectrumStyle
  }
  buttons: {
    background: string
    backgroundHover: string
    backgroundActive: string
    borderLight: string
    borderDark: string
    iconColor: string
    activeBackground: string
    activeIconColor: string
    activeIconShadow: string
    toggleActiveColor: string
    toggleActiveShadow: string
    boxShadow: string
  }
  seekbar: {
    grooveBg: string
    borderTop: string
    borderLeft: string
    borderRight: string
    borderBottom: string
    fillBg: string
    fillGlow: string
    thumbBg: string
    thumbBorderLight: string
    thumbBorderDark: string
  }
  volume: {
    iconColor: string
    grooveBg: string
    fillBg: string
    fillGlow: string
    thumbBg: string
    thumbBorderLight: string
    thumbBorderDark: string
  }
  easterEgg: {
    flickerColor: string
    glitchShadow: string
  }
}
