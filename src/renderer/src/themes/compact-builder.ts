import type { CompactSkin, CompactSkinSeed } from './types'

// --- Color math utilities ---

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  )
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// --- Builder ---

export function buildCompactSkin(seed: CompactSkinSeed): CompactSkin {
  const { shell, display, text, accent, style, spectrum } = seed

  const shellLight = lighten(shell, 0.15)
  const shellDark = darken(shell, 0.3)
  const shellMid = lighten(shell, 0.08)
  const textRgb = hexToRgb(text)
  const accentRgb = hexToRgb(accent)
  const displayDark = darken(display, 0.2)
  const textDim = darken(text, 0.4)

  // Button shape
  const btnRadius = style === 'pill' ? '11px' : style === 'flat' ? '3px' : '0px'
  const shellRadius = style === 'pill' ? '8px' : '4px'

  // Button backgrounds per style
  const btnBg =
    style === 'beveled'
      ? `linear-gradient(180deg, ${shellLight} 0%, ${shell} 50%, ${shellDark} 100%)`
      : style === 'flat'
        ? shell
        : `linear-gradient(180deg, ${shellLight} 0%, ${shell} 100%)`

  const btnBgHover =
    style === 'beveled'
      ? `linear-gradient(180deg, ${lighten(shell, 0.22)} 0%, ${shellMid} 50%, ${shell} 100%)`
      : style === 'flat'
        ? lighten(shell, 0.1)
        : `linear-gradient(180deg, ${lighten(shell, 0.22)} 0%, ${shellMid} 100%)`

  const btnBgActive =
    style === 'beveled'
      ? `linear-gradient(180deg, ${shellDark} 0%, ${shell} 50%, ${shellMid} 100%)`
      : style === 'flat'
        ? darken(shell, 0.1)
        : `linear-gradient(180deg, ${darken(shell, 0.05)} 0%, ${shellLight} 100%)`

  const btnBorderLight =
    style === 'beveled' ? lighten(shell, 0.3) : style === 'flat' ? lighten(shell, 0.12) : lighten(shell, 0.18)
  const btnBorderDark =
    style === 'beveled' ? darken(shell, 0.5) : style === 'flat' ? darken(shell, 0.15) : darken(shell, 0.2)

  const btnShadow =
    style === 'beveled'
      ? `inset 0 1px 0 ${alpha('#ffffff', 0.08)}`
      : style === 'flat'
        ? 'none'
        : `0 1px 3px ${alpha('#000000', 0.2)}`

  // Shell background
  const shellBg = seed.shellBackground
    ? seed.shellBackground
    : `linear-gradient(180deg, ${shellMid} 0%, ${shell} 40%, ${shellDark} 100%)`

  // Display background
  const displayBg = seed.displayBackground
    ? seed.displayBackground
    : `linear-gradient(180deg, ${darken(display, 0.15)} 0%, ${display} 40%, ${darken(display, 0.1)} 100%)`

  return {
    shell: {
      background: shellBg,
      borderTop: `1px solid ${lighten(shell, 0.2)}`,
      borderLeft: `1px solid ${lighten(shell, 0.15)}`,
      borderRight: `1px solid ${darken(shell, 0.4)}`,
      borderBottom: `1px solid ${darken(shell, 0.5)}`,
      boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.06)}, 0 2px 12px ${alpha('#000000', 0.6)}`,
      borderRadius: shellRadius,
      fontFamily: "'Tahoma', 'Arial', sans-serif",
    },
    scanlines: `repeating-linear-gradient(0deg, transparent 0px, transparent 1px, ${alpha('#000000', 0.06)} 1px, ${alpha('#000000', 0.06)} 2px)`,
    titlebar: {
      background: `linear-gradient(180deg, ${shellLight} 0%, ${shellDark} 100%)`,
      borderBottom: `1px solid ${darken(shell, 0.4)}`,
      textColor: lighten(shell, 0.4),
      textShadow: `0 -1px 0 ${darken(shell, 0.6)}, 0 1px 0 ${alpha('#ffffff', 0.05)}`,
      buttonBg: `linear-gradient(180deg, ${shellLight} 0%, ${shell} 100%)`,
      buttonBorderLight: lighten(shell, 0.25),
      buttonBorderDark: darken(shell, 0.4),
      buttonIconColor: lighten(shell, 0.45),
      closeHoverBg: `linear-gradient(180deg, #a03030 0%, #802020 100%)`,
    },
    display: {
      background: displayBg,
      borderTop: `1px solid ${darken(display, 0.4)}`,
      borderLeft: `1px solid ${darken(display, 0.3)}`,
      borderRight: `1px solid ${lighten(display, 0.15)}`,
      borderBottom: `1px solid ${lighten(display, 0.2)}`,
      boxShadow: `inset 0 1px 4px ${alpha('#000000', 0.8)}, inset 0 0 8px ${alpha('#000000', 0.4)}`,
      borderRadius: '2px',
      scanlines: `repeating-linear-gradient(0deg, transparent 0px, transparent 1px, ${alpha('#000000', 0.15)} 1px, ${alpha('#000000', 0.15)} 2px)`,
      textColor: text,
      textShadow: `0 0 6px ${alpha(text, 0.7)}, 0 0 12px ${alpha(text, 0.3)}`,
      textDimColor: textDim,
      textDimShadow: `0 0 4px ${alpha(textDim, 0.5)}`,
      fontFamily: "'Consolas', 'Courier New', monospace",
    },
    spectrum: {
      barColor: text,
      barColorRgb: textRgb,
      glowAlpha: 0.5,
      style: spectrum,
    },
    buttons: {
      background: btnBg,
      backgroundHover: btnBgHover,
      backgroundActive: btnBgActive,
      borderLight: btnBorderLight,
      borderDark: btnBorderDark,
      iconColor: lighten(shell, 0.5),
      activeBackground: `linear-gradient(180deg, ${darken(shell, 0.2)} 0%, ${shell} 100%)`,
      activeIconColor: accent,
      activeIconShadow: `0 0 4px ${alpha(accent, 0.5)}`,
      toggleActiveColor: accent,
      toggleActiveShadow: `0 0 6px ${alpha(accent, 0.6)}`,
      boxShadow: btnShadow,
    },
    seekbar: {
      grooveBg: `linear-gradient(180deg, ${darken(shell, 0.45)} 0%, ${darken(shell, 0.3)} 100%)`,
      borderTop: `1px solid ${darken(shell, 0.5)}`,
      borderLeft: `1px solid ${darken(shell, 0.45)}`,
      borderRight: `1px solid ${lighten(shell, 0.1)}`,
      borderBottom: `1px solid ${lighten(shell, 0.15)}`,
      fillBg: `linear-gradient(180deg, ${accent} 0%, ${darken(accent, 0.2)} 100%)`,
      fillGlow: `0 0 4px ${alpha(accent, 0.3)}`,
      thumbBg: `linear-gradient(180deg, ${lighten(shell, 0.3)} 0%, ${shell} 50%, ${shellDark} 100%)`,
      thumbBorderLight: lighten(shell, 0.4),
      thumbBorderDark: darken(shell, 0.4),
    },
    volume: {
      iconColor: lighten(shell, 0.4),
      grooveBg: `linear-gradient(180deg, ${darken(shell, 0.45)} 0%, ${darken(shell, 0.3)} 100%)`,
      fillBg: `linear-gradient(180deg, ${accent} 0%, ${darken(accent, 0.2)} 100%)`,
      fillGlow: `0 0 3px ${alpha(accent, 0.2)}`,
      thumbBg: `linear-gradient(180deg, ${lighten(shell, 0.3)} 0%, ${shell} 50%, ${shellDark} 100%)`,
      thumbBorderLight: lighten(shell, 0.4),
      thumbBorderDark: darken(shell, 0.4),
    },
    easterEgg: {
      flickerColor: alpha(accentRgb[0] > 200 ? accent : text, 0.15),
      glitchShadow: `0 0 6px ${alpha(text, 0.9)}, 0 0 12px ${alpha(text, 0.5)}, 2px 0 0 ${alpha(accent, 0.3)}`,
    },
  }
}
