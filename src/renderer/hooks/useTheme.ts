import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

type Theme = AppSettings['theme']

function getSystemDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: Theme) {
  const isDark = theme === 'dark' || (theme === 'system' && getSystemDarkMode())
  document.documentElement.classList.toggle('dark', isDark)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_SETTINGS.theme)

  // Load saved theme on mount
  useEffect(() => {
    window.api.settings.get().then((settings: AppSettings) => {
      setThemeState(settings.theme)
      applyTheme(settings.theme)
    })
  }, [])

  // Listen for system theme changes when using 'system' mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)

    // Persist theme to settings immediately
    try {
      const settings = await window.api.settings.get()
      await window.api.settings.set({ ...settings, theme: newTheme })
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }

  return { theme, setTheme }
}
