import { useState } from 'react'
import { useThemeStore } from '../stores/theme'
import { allThemes } from '../themes'

export function ThemePicker(): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { currentThemeId, setTheme } = useThemeStore()

  return (
    <div className="px-3 mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-2 py-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider cursor-pointer flex items-center gap-1"
      >
        <span className="transition-transform" style={{ display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
        Skins
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {allThemes.map(theme => (
            <button
              key={theme.id}
              onClick={() => setTheme(theme.id)}
              className={`text-left p-2 rounded cursor-pointer transition-colors border ${
                currentThemeId === theme.id
                  ? 'border-accent bg-bg-highlight'
                  : 'border-transparent hover:bg-bg-tertiary/60'
              }`}
            >
              <p className="text-[11px] text-text-secondary font-medium truncate mb-1">{theme.name}</p>
              <div className="flex gap-1">
                {theme.previewColors.map((color, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full border border-border-primary"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
