import { create } from 'zustand'

/**
 * Developer mode: shows instrumentation.
 *
 * The line this draws is instrument versus product. Anything that reports
 * numbers *about* the system — how modes are performing, how thresholds move
 * the answer — is an instrument, and it stays hidden. Anything that changes
 * what gets played is product and ships to everyone.
 *
 * An instrument graduates when its defaults work untuned and its numbers mean
 * something to someone who did not build it. Adjustable thresholds are the
 * tell that it has not: the controls exist because the right value is unknown,
 * and shipping that uncertainty reads as a measurement rather than a guess.
 *
 * Unlike `useCapabilityStore`, this really is a preference — it says what you
 * want to see, not what the install can do.
 */
const SETTING_KEY = 'developer_mode'

interface DeveloperState {
  enabled: boolean
  loaded: boolean
  load: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
}

export const useDeveloperStore = create<DeveloperState>((set) => ({
  enabled: false,
  loaded: false,

  load: async () => {
    try {
      const raw = await window.api.getSetting(SETTING_KEY)
      set({ enabled: raw === 'true', loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setEnabled: async (enabled) => {
    set({ enabled })
    try {
      await window.api.setSetting(SETTING_KEY, String(enabled))
    } catch (err) {
      console.error('Failed to persist developer mode', err)
    }
  }
}))
