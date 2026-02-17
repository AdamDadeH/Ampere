import { useCallback, useState } from 'react'
import type { CompactSkin } from '../../themes/types'
import { TITLEBAR_SPRITES, spriteStyleScaled } from '../../themes/sprite-constants'

interface CompactTitleBarProps {
  onSwitchToLibrary: () => void
  skin: CompactSkin
}

const TITLEBAR_SHEET_W = 275
const TITLEBAR_SHEET_H = 58
const TITLEBAR_DISPLAY_H = 20 // our titlebar height
const CHROME_BTN_SIZE = 14

function SpriteChromeBtn({
  dataUrl,
  normal,
  pressed,
  onClick,
  title,
}: {
  dataUrl: string
  normal: typeof TITLEBAR_SPRITES.close
  pressed: typeof TITLEBAR_SPRITES.closePressed
  onClick: () => void
  title: string
}): React.JSX.Element {
  const [isPressed, setIsPressed] = useState(false)
  const region = isPressed ? pressed : normal
  const style = spriteStyleScaled(dataUrl, region, CHROME_BTN_SIZE, CHROME_BTN_SIZE, TITLEBAR_SHEET_W, TITLEBAR_SHEET_H)

  return (
    <button
      className="compact-chrome-btn compact-sprite-btn"
      onClick={onClick}
      title={title}
      style={style}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    />
  )
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
  const sprites = skin.sprites
  const hasTitlebar = !!sprites?.titlebarBmp

  // --- Sprite render path ---
  if (hasTitlebar) {
    const dataUrl = sprites!.titlebarBmp!
    // Scale the active titlebar to fit our 400px width, 20px height
    const scaleX = 400 / TITLEBAR_SPRITES.active.w
    const scaleY = TITLEBAR_DISPLAY_H / TITLEBAR_SPRITES.active.h

    const titlebarBgStyle: React.CSSProperties = {
      backgroundImage: `url(${dataUrl})`,
      backgroundPosition: `-${TITLEBAR_SPRITES.active.x * scaleX}px -${TITLEBAR_SPRITES.active.y * scaleY}px`,
      backgroundSize: `${TITLEBAR_SHEET_W * scaleX}px ${TITLEBAR_SHEET_H * scaleY}px`,
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
    }

    return (
      <div className="compact-titlebar compact-sprite" style={titlebarBgStyle}>
        <div className="compact-titlebar-drag" />
        <div className="compact-titlebar-buttons">
          <SpriteChromeBtn
            dataUrl={dataUrl}
            normal={TITLEBAR_SPRITES.minimize}
            pressed={TITLEBAR_SPRITES.minimizePressed}
            onClick={handleMinimize}
            title="Minimize"
          />
          <SpriteChromeBtn
            dataUrl={dataUrl}
            normal={TITLEBAR_SPRITES.shade}
            pressed={TITLEBAR_SPRITES.shadePressed}
            onClick={onSwitchToLibrary}
            title="Library mode"
          />
          <SpriteChromeBtn
            dataUrl={dataUrl}
            normal={TITLEBAR_SPRITES.close}
            pressed={TITLEBAR_SPRITES.closePressed}
            onClick={handleClose}
            title="Close"
          />
        </div>
      </div>
    )
  }

  // --- Fallback render path ---
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
          AMPERE
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
