import { useTheme } from '@/context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

interface ThemeToggleProps {
  className?: string
  variant?: 'compact' | 'pill'
  showLabel?: boolean
}

export default function ThemeToggle({
  className = '',
  variant = 'compact',
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  if (variant === 'pill' || showLabel) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-pill bg-surface hover:bg-surface-hover border border-border hover:border-border-strong text-xs font-semibold text-text-secondary hover:text-text-primary transition-all duration-fast cursor-pointer select-none ${className}`}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="relative w-4 h-4 flex items-center justify-center">
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-accent stroke-[2] transition-transform duration-fast rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-accent stroke-[2] transition-transform duration-fast rotate-0 hover:-rotate-12" />
          )}
        </span>
        <span className="capitalize">{theme} Mode</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-8 h-8 rounded-md bg-surface hover:bg-surface-hover border border-border hover:border-border-strong flex items-center justify-center text-text-secondary hover:text-text-primary transition-all duration-fast cursor-pointer select-none ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-accent stroke-[2] transition-transform duration-fast hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-accent stroke-[2] transition-transform duration-fast hover:-rotate-12" />
      )}
    </button>
  )
}

