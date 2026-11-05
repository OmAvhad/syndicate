import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'info' | 'danger' | 'muted'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-accent-soft text-accent border-accent/25',
    accent: 'bg-accent-soft text-accent border-accent/25',
    success: 'bg-semantic-success/12 text-semantic-success border-semantic-success/25',
    warning: 'bg-semantic-warning/12 text-semantic-warning border-semantic-warning/25',
    info: 'bg-semantic-info/12 text-semantic-info border-semantic-info/25',
    danger: 'bg-semantic-danger/12 text-semantic-danger border-semantic-danger/25',
    muted: 'bg-surface-raised text-text-secondary border-border',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-xs font-semibold tracking-wide border',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
