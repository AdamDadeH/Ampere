import React, { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  icon?: React.ReactNode
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Clamp menu position to viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) {
      menuRef.current.style.left = `${Math.max(0, vw - rect.width - 4)}px`
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${Math.max(0, vh - rect.height - 4)}px`
    }
  }, [x, y])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-bg-secondary border border-border-secondary rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer flex items-center gap-2"
          onClick={() => {
            item.onClick()
            onClose()
          }}
        >
          {item.icon && <span className="w-4 h-4 flex items-center justify-center text-xs">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}
