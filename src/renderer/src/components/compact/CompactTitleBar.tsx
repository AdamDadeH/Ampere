import { useCallback, useState } from 'react'
import type { CompactSkin } from '../../themes/types'

interface CompactTitleBarProps {
  onSwitchToLibrary: () => void
  skin: CompactSkin
}

export function CompactTitleBar({ onSwitchToLibrary, skin }: CompactTitleBarProps): React.JSX.Element {
  const [closeHover, setCloseHover] = useState(false)

  const handleMinimize = useCallback(() => {
    window.api.windowMinimize()
  }, [])

  const handleClose = useCallback(() => {
    window.api.windowClose()
  }, [])

  const tb = skin.titlebar

  const titlebarStyle: React.CSSProperties = {
    background: tb.background,
    borderBottom: tb.borderBottom,
  }

  const btnStyle: React.CSSProperties = {
    background: tb.buttonBg,
    borderTop: `1px solid ${tb.buttonBorderLight}`,
    borderLeft: `1px solid ${tb.buttonBorderLight}`,
    borderRight: `1px solid ${tb.buttonBorderDark}`,
    borderBottom: `1px solid ${tb.buttonBorderDark}`,
  }

  const closeBtnStyle: React.CSSProperties = {
    ...btnStyle,
    ...(closeHover ? { background: tb.closeHoverBg } : {}),
  }

  return (
    <div className="compact-titlebar" style={titlebarStyle}>
      <div className="compact-titlebar-drag">
        <span className="compact-titlebar-text" style={{ color: tb.textColor, textShadow: tb.textShadow }}>
          PROTONMUSIC
        </span>
      </div>
      <div className="compact-titlebar-buttons">
        <button className="compact-chrome-btn" onClick={handleMinimize} title="Minimize" style={btnStyle}>
          <span className="compact-chrome-icon" style={{ color: tb.buttonIconColor }}>_</span>
        </button>
        <button className="compact-chrome-btn" onClick={onSwitchToLibrary} title="Library mode" style={btnStyle}>
          <span className="compact-chrome-icon" style={{ color: tb.buttonIconColor }}>&#9633;</span>
        </button>
        <button
          className="compact-chrome-btn"
          onClick={handleClose}
          title="Close"
          style={closeBtnStyle}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
        >
          <span className="compact-chrome-icon" style={{ color: closeHover ? '#fff' : tb.buttonIconColor }}>&times;</span>
        </button>
      </div>
    </div>
  )
}
