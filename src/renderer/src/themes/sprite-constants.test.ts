import { describe, it, expect } from 'vitest'
import {
  WINAMP_LAYOUT,
  EQMAIN_SPRITES,
  CBUTTONS_SPRITES,
  POSBAR_SPRITES,
  VOLUME_SPRITES,
  SHUFREP_SPRITES,
  TITLEBAR_SPRITES,
  PLAYPAUS_SPRITES,
  MONOSTER_SPRITES,
  NUMBERS_CHAR_MAP,
  TEXT_CHAR_MAP,
  BALANCE_SPRITES,
  volumeFrame,
  balanceFrame,
  type SpriteRegion,
} from './sprite-constants'

// ─── Helpers ────────────────────────────────────────────────────────────

function allRegions(obj: Record<string, unknown>): [string, SpriteRegion][] {
  return Object.entries(obj).filter(
    ([, v]) => v && typeof v === 'object' && 'x' in (v as object) && 'w' in (v as object)
  ) as [string, SpriteRegion][]
}

function expectRegionNonNegative(name: string, region: SpriteRegion): void {
  expect(region.x, `${name}.x`).toBeGreaterThanOrEqual(0)
  expect(region.y, `${name}.y`).toBeGreaterThanOrEqual(0)
  expect(region.w, `${name}.w`).toBeGreaterThan(0)
  expect(region.h, `${name}.h`).toBeGreaterThan(0)
}

// ─── WINAMP_LAYOUT (275x116 main window) ────────────────────────────────

describe('WINAMP_LAYOUT', () => {
  it('main window is 275x116', () => {
    expect(WINAMP_LAYOUT.width).toBe(275)
    expect(WINAMP_LAYOUT.height).toBe(116)
  })

  it('titlebar spans full width at top', () => {
    expect(WINAMP_LAYOUT.titlebar).toEqual({ x: 0, y: 0, w: 275, h: 14 })
  })

  it('all regions fit within 275x116', () => {
    const regions = allRegions(WINAMP_LAYOUT as unknown as Record<string, unknown>)
    for (const [name, r] of regions) {
      expect(r.x + r.w, `${name} right edge`).toBeLessThanOrEqual(275)
      expect(r.y + r.h, `${name} bottom edge`).toBeLessThanOrEqual(116)
    }
  })

  it('transport buttons are in correct order left-to-right', () => {
    expect(WINAMP_LAYOUT.prev.x).toBeLessThan(WINAMP_LAYOUT.play.x)
    expect(WINAMP_LAYOUT.play.x).toBeLessThan(WINAMP_LAYOUT.pause.x)
    expect(WINAMP_LAYOUT.pause.x).toBeLessThan(WINAMP_LAYOUT.stop.x)
    expect(WINAMP_LAYOUT.stop.x).toBeLessThan(WINAMP_LAYOUT.next.x)
    expect(WINAMP_LAYOUT.next.x).toBeLessThan(WINAMP_LAYOUT.eject.x)
  })

  it('transport buttons are at y=88 (below seekbar)', () => {
    expect(WINAMP_LAYOUT.prev.y).toBe(88)
    expect(WINAMP_LAYOUT.play.y).toBe(88)
    expect(WINAMP_LAYOUT.pause.y).toBe(88)
    expect(WINAMP_LAYOUT.stop.y).toBe(88)
    expect(WINAMP_LAYOUT.next.y).toBe(88)
  })

  it('seekbar is above transport buttons', () => {
    expect(WINAMP_LAYOUT.seekbar.y + WINAMP_LAYOUT.seekbar.h)
      .toBeLessThanOrEqual(WINAMP_LAYOUT.prev.y)
  })

  it('EQ and PL buttons are adjacent', () => {
    expect(WINAMP_LAYOUT.plBtn.x).toBe(WINAMP_LAYOUT.eqBtn.x + WINAMP_LAYOUT.eqBtn.w)
  })

  it('volume and balance are on the same row', () => {
    expect(WINAMP_LAYOUT.volume.y).toBe(WINAMP_LAYOUT.balance.y)
  })

  it('shuffle and repeat are on the bottom row', () => {
    expect(WINAMP_LAYOUT.shuffle.y).toBe(89)
    expect(WINAMP_LAYOUT.repeat.y).toBe(89)
  })
})

// ─── EQMAIN_SPRITES (Winamp 2.x EQMAIN.BMP spec) ──────────────────────

describe('EQMAIN_SPRITES', () => {
  it('background is 275x116 at origin', () => {
    expect(EQMAIN_SPRITES.background).toEqual({ x: 0, y: 0, w: 275, h: 116 })
  })

  it('active titlebar is at y=134', () => {
    expect(EQMAIN_SPRITES.titlebarActive).toEqual({ x: 0, y: 134, w: 275, h: 14 })
  })

  it('inactive titlebar is at y=149', () => {
    expect(EQMAIN_SPRITES.titlebarInactive).toEqual({ x: 0, y: 149, w: 275, h: 14 })
  })

  it('ON button has 4 states (off, offPressed, on, onPressed)', () => {
    expect(EQMAIN_SPRITES.onOff).toEqual({ x: 10, y: 119, w: 26, h: 12 })
    expect(EQMAIN_SPRITES.onOffPressed).toEqual({ x: 128, y: 119, w: 26, h: 12 })
    expect(EQMAIN_SPRITES.onOn).toEqual({ x: 69, y: 119, w: 26, h: 12 })
    expect(EQMAIN_SPRITES.onOnPressed).toEqual({ x: 187, y: 119, w: 26, h: 12 })
  })

  it('all ON button states have same dimensions', () => {
    expect(EQMAIN_SPRITES.onOff.w).toBe(EQMAIN_SPRITES.onOn.w)
    expect(EQMAIN_SPRITES.onOff.h).toBe(EQMAIN_SPRITES.onOn.h)
    expect(EQMAIN_SPRITES.onOffPressed.w).toBe(EQMAIN_SPRITES.onOn.w)
    expect(EQMAIN_SPRITES.onOnPressed.w).toBe(EQMAIN_SPRITES.onOn.w)
  })

  it('AUTO button has 4 states', () => {
    expect(EQMAIN_SPRITES.autoOff).toEqual({ x: 36, y: 119, w: 32, h: 12 })
    expect(EQMAIN_SPRITES.autoOffPressed).toEqual({ x: 154, y: 119, w: 32, h: 12 })
    expect(EQMAIN_SPRITES.autoOn).toEqual({ x: 95, y: 119, w: 32, h: 12 })
    expect(EQMAIN_SPRITES.autoOnPressed).toEqual({ x: 213, y: 119, w: 32, h: 12 })
  })

  it('all AUTO button states have same dimensions', () => {
    const w = EQMAIN_SPRITES.autoOff.w
    const h = EQMAIN_SPRITES.autoOff.h
    expect(EQMAIN_SPRITES.autoOffPressed.w).toBe(w)
    expect(EQMAIN_SPRITES.autoOn.w).toBe(w)
    expect(EQMAIN_SPRITES.autoOnPressed.w).toBe(w)
    expect(EQMAIN_SPRITES.autoOff.h).toBe(h)
  })

  it('slider thumb is 11x11', () => {
    expect(EQMAIN_SPRITES.thumb).toEqual({ x: 0, y: 164, w: 11, h: 11 })
  })

  it('pressed thumb is at y=176 (same x, 12px below normal)', () => {
    expect(EQMAIN_SPRITES.thumbPressed.x).toBe(EQMAIN_SPRITES.thumb.x)
    expect(EQMAIN_SPRITES.thumbPressed.y).toBe(176)
    expect(EQMAIN_SPRITES.thumbPressed.w).toBe(EQMAIN_SPRITES.thumb.w)
    expect(EQMAIN_SPRITES.thumbPressed.h).toBe(EQMAIN_SPRITES.thumb.h)
  })

  it('presets button is 44x12', () => {
    expect(EQMAIN_SPRITES.presets.w).toBe(44)
    expect(EQMAIN_SPRITES.presets.h).toBe(12)
    expect(EQMAIN_SPRITES.presetsPressed.w).toBe(44)
  })

  it('close button is 9x9', () => {
    expect(EQMAIN_SPRITES.close).toEqual({ x: 0, y: 116, w: 9, h: 9 })
    expect(EQMAIN_SPRITES.closePressed).toEqual({ x: 0, y: 125, w: 9, h: 9 })
  })

  it('ON/AUTO button sprites do not overlap each other', () => {
    const onStates = [EQMAIN_SPRITES.onOff, EQMAIN_SPRITES.onOffPressed, EQMAIN_SPRITES.onOn, EQMAIN_SPRITES.onOnPressed]
    const autoStates = [EQMAIN_SPRITES.autoOff, EQMAIN_SPRITES.autoOffPressed, EQMAIN_SPRITES.autoOn, EQMAIN_SPRITES.autoOnPressed]

    for (const on of onStates) {
      for (const auto of autoStates) {
        // Check that no ON sprite overlaps any AUTO sprite
        const overlapX = on.x < auto.x + auto.w && on.x + on.w > auto.x
        const overlapY = on.y < auto.y + auto.h && on.y + on.h > auto.y
        expect(overlapX && overlapY, `ON(${on.x},${on.y}) overlaps AUTO(${auto.x},${auto.y})`).toBe(false)
      }
    }
  })

  it('all regions have non-negative coordinates and positive dimensions', () => {
    const regions = allRegions(EQMAIN_SPRITES as unknown as Record<string, unknown>)
    for (const [name, r] of regions) {
      expectRegionNonNegative(`EQMAIN.${name}`, r)
    }
  })
})

// ─── CBUTTONS_SPRITES (transport buttons) ───────────────────────────────

describe('CBUTTONS_SPRITES', () => {
  it('normal states are on row 0 (y=0)', () => {
    expect(CBUTTONS_SPRITES.previous.y).toBe(0)
    expect(CBUTTONS_SPRITES.play.y).toBe(0)
    expect(CBUTTONS_SPRITES.pause.y).toBe(0)
    expect(CBUTTONS_SPRITES.stop.y).toBe(0)
    expect(CBUTTONS_SPRITES.next.y).toBe(0)
  })

  it('pressed states are on row 1 (y=18 for main, y=16 for eject)', () => {
    expect(CBUTTONS_SPRITES.previousPressed.y).toBe(18)
    expect(CBUTTONS_SPRITES.playPressed.y).toBe(18)
    expect(CBUTTONS_SPRITES.pausePressed.y).toBe(18)
    expect(CBUTTONS_SPRITES.stopPressed.y).toBe(18)
    expect(CBUTTONS_SPRITES.nextPressed.y).toBe(18)
    expect(CBUTTONS_SPRITES.ejectPressed.y).toBe(16)
  })

  it('each button pair shares the same x and width', () => {
    expect(CBUTTONS_SPRITES.previous.x).toBe(CBUTTONS_SPRITES.previousPressed.x)
    expect(CBUTTONS_SPRITES.play.x).toBe(CBUTTONS_SPRITES.playPressed.x)
    expect(CBUTTONS_SPRITES.pause.x).toBe(CBUTTONS_SPRITES.pausePressed.x)
    expect(CBUTTONS_SPRITES.stop.x).toBe(CBUTTONS_SPRITES.stopPressed.x)
    expect(CBUTTONS_SPRITES.eject.x).toBe(CBUTTONS_SPRITES.ejectPressed.x)
  })

  it('buttons are arranged left-to-right with no gaps', () => {
    expect(CBUTTONS_SPRITES.play.x).toBe(CBUTTONS_SPRITES.previous.x + CBUTTONS_SPRITES.previous.w)
    expect(CBUTTONS_SPRITES.pause.x).toBe(CBUTTONS_SPRITES.play.x + CBUTTONS_SPRITES.play.w)
    expect(CBUTTONS_SPRITES.stop.x).toBe(CBUTTONS_SPRITES.pause.x + CBUTTONS_SPRITES.pause.w)
    expect(CBUTTONS_SPRITES.next.x).toBe(CBUTTONS_SPRITES.stop.x + CBUTTONS_SPRITES.stop.w)
  })

  it('main transport buttons are 23x18', () => {
    expect(CBUTTONS_SPRITES.previous.w).toBe(23)
    expect(CBUTTONS_SPRITES.previous.h).toBe(18)
  })

  it('eject button is 22x16', () => {
    expect(CBUTTONS_SPRITES.eject.w).toBe(22)
    expect(CBUTTONS_SPRITES.eject.h).toBe(16)
  })
})

// ─── POSBAR_SPRITES (seek bar) ──────────────────────────────────────────

describe('POSBAR_SPRITES', () => {
  it('track is 248x10 at origin', () => {
    expect(POSBAR_SPRITES.track).toEqual({ x: 0, y: 0, w: 248, h: 10 })
  })

  it('thumb is 29x10 adjacent to track', () => {
    expect(POSBAR_SPRITES.thumb.x).toBe(248)
    expect(POSBAR_SPRITES.thumb.w).toBe(29)
    expect(POSBAR_SPRITES.thumb.h).toBe(10)
  })

  it('pressed thumb is at x=278 (1px gap after normal thumb)', () => {
    expect(POSBAR_SPRITES.thumbPressed.x).toBe(278)
    expect(POSBAR_SPRITES.thumbPressed.w).toBe(29)
  })
})

// ─── VOLUME_SPRITES ─────────────────────────────────────────────────────

describe('VOLUME_SPRITES', () => {
  it('thumb is 14x11', () => {
    expect(VOLUME_SPRITES.thumb.w).toBe(14)
    expect(VOLUME_SPRITES.thumb.h).toBe(11)
  })

  it('pressed thumb has same dimensions', () => {
    expect(VOLUME_SPRITES.thumbPressed.w).toBe(VOLUME_SPRITES.thumb.w)
    expect(VOLUME_SPRITES.thumbPressed.h).toBe(VOLUME_SPRITES.thumb.h)
  })
})

describe('volumeFrame', () => {
  it('generates 28 frames (indices 0-27)', () => {
    for (let i = 0; i < 28; i++) {
      const frame = volumeFrame(i)
      expect(frame.w).toBe(68)
      expect(frame.h).toBe(13)
      expect(frame.y).toBe(i * 15)
    }
  })

  it('frames do not overlap vertically', () => {
    for (let i = 0; i < 27; i++) {
      const current = volumeFrame(i)
      const next = volumeFrame(i + 1)
      expect(current.y + current.h).toBeLessThanOrEqual(next.y)
    }
  })
})

// ─── SHUFREP_SPRITES ───────────────────────────────────────────────────

describe('SHUFREP_SPRITES', () => {
  it('repeat button is 28x15', () => {
    expect(SHUFREP_SPRITES.repeatOff.w).toBe(28)
    expect(SHUFREP_SPRITES.repeatOff.h).toBe(15)
  })

  it('shuffle button is 47x15', () => {
    expect(SHUFREP_SPRITES.shuffleOff.w).toBe(47)
    expect(SHUFREP_SPRITES.shuffleOff.h).toBe(15)
  })

  it('EQ toggle is 23x12', () => {
    expect(SHUFREP_SPRITES.eqOff.w).toBe(23)
    expect(SHUFREP_SPRITES.eqOff.h).toBe(12)
  })

  it('PL toggle is 23x12 adjacent to EQ', () => {
    expect(SHUFREP_SPRITES.plOff.x).toBe(SHUFREP_SPRITES.eqOff.x + SHUFREP_SPRITES.eqOff.w)
    expect(SHUFREP_SPRITES.plOff.w).toBe(23)
    expect(SHUFREP_SPRITES.plOff.h).toBe(12)
  })

  it('EQ/PL on states are 12px below off states', () => {
    expect(SHUFREP_SPRITES.eqOn.y).toBe(SHUFREP_SPRITES.eqOff.y + 12)
    expect(SHUFREP_SPRITES.plOn.y).toBe(SHUFREP_SPRITES.plOff.y + 12)
  })

  it('all states have non-negative coordinates', () => {
    const regions = allRegions(SHUFREP_SPRITES as unknown as Record<string, unknown>)
    for (const [name, r] of regions) {
      expectRegionNonNegative(`SHUFREP.${name}`, r)
    }
  })
})

// ─── TITLEBAR_SPRITES ───────────────────────────────────────────────────

describe('TITLEBAR_SPRITES', () => {
  it('active titlebar is 275x14', () => {
    expect(TITLEBAR_SPRITES.active.w).toBe(275)
    expect(TITLEBAR_SPRITES.active.h).toBe(14)
  })

  it('close/minimize/shade buttons are 9x9', () => {
    expect(TITLEBAR_SPRITES.close.w).toBe(9)
    expect(TITLEBAR_SPRITES.close.h).toBe(9)
    expect(TITLEBAR_SPRITES.minimize.w).toBe(9)
    expect(TITLEBAR_SPRITES.shade.w).toBe(9)
  })

  it('pressed states have same dimensions as normal', () => {
    expect(TITLEBAR_SPRITES.closePressed.w).toBe(TITLEBAR_SPRITES.close.w)
    expect(TITLEBAR_SPRITES.closePressed.h).toBe(TITLEBAR_SPRITES.close.h)
    expect(TITLEBAR_SPRITES.minimizePressed.w).toBe(TITLEBAR_SPRITES.minimize.w)
    expect(TITLEBAR_SPRITES.shadePressed.w).toBe(TITLEBAR_SPRITES.shade.w)
  })
})

// ─── NUMBERS_CHAR_MAP / TEXT_CHAR_MAP ───────────────────────────────────

describe('NUMBERS_CHAR_MAP', () => {
  it('contains digits 0-9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(NUMBERS_CHAR_MAP[String(i)]).toBeDefined()
    }
  })

  it('each digit is 9x13', () => {
    for (let i = 0; i <= 9; i++) {
      const r = NUMBERS_CHAR_MAP[String(i)]
      expect(r.w).toBe(9)
      expect(r.h).toBe(13)
    }
  })

  it('digits are laid out sequentially at x = i*9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(NUMBERS_CHAR_MAP[String(i)].x).toBe(i * 9)
    }
  })

  it('contains space character', () => {
    expect(NUMBERS_CHAR_MAP[' ']).toBeDefined()
  })
})

describe('TEXT_CHAR_MAP', () => {
  it('contains A-Z', () => {
    for (let c = 65; c <= 90; c++) {
      expect(TEXT_CHAR_MAP[String.fromCharCode(c)], `missing ${String.fromCharCode(c)}`).toBeDefined()
    }
  })

  it('contains a-z (mapped to uppercase)', () => {
    for (let c = 97; c <= 122; c++) {
      const lower = String.fromCharCode(c)
      const upper = String.fromCharCode(c - 32)
      expect(TEXT_CHAR_MAP[lower]).toEqual(TEXT_CHAR_MAP[upper])
    }
  })

  it('contains digits 0-9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(TEXT_CHAR_MAP[String(i)]).toBeDefined()
    }
  })

  it('each character is 5x6', () => {
    for (const [, r] of Object.entries(TEXT_CHAR_MAP)) {
      expect(r.w).toBe(5)
      expect(r.h).toBe(6)
    }
  })

  it('contains common punctuation', () => {
    for (const ch of [':', '-', '(', ')', '.', '!', '+']) {
      expect(TEXT_CHAR_MAP[ch], `missing '${ch}'`).toBeDefined()
    }
  })
})
