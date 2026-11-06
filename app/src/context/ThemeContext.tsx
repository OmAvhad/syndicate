import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { darkColors, lightColors, type ColorPalette } from '../constants/theme'
import { storage } from '../utils/storage'

export type ThemeMode = 'dark' | 'light'

export interface ThemeContextType {
  mode: ThemeMode
  colors: ColorPalette
  toggleTheme: () => void
  setThemeMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setMode] = useState<ThemeMode>(systemScheme === 'light' ? 'light' : 'dark')

  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await storage.getItem('syndicate_theme')
        if (saved === 'dark' || saved === 'light') {
          setMode(saved)
        }
      } catch {
        // fallback
      }
    }
    loadTheme()
  }, [])

  const setThemeMode = async (newMode: ThemeMode) => {
    setMode(newMode)
    await storage.setItem('syndicate_theme', newMode)
  }

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setThemeMode(next)
  }

  const colors = mode === 'dark' ? darkColors : lightColors

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
