import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-text-inverse hover:bg-[#d4f885] hover:-translate-y-px active:translate-y-0 shadow-[0_2px_14px_rgba(198,243,106,0.2)]',
        secondary:
          'bg-surface-raised text-text-primary border border-border hover:bg-surface-hover hover:border-border-strong',
        outline:
          'border border-border text-text-primary hover:bg-surface-raised hover:border-border-strong',
        ghost:
          'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
        destructive:
          'bg-semantic-danger/15 text-semantic-danger border border-semantic-danger/30 hover:bg-semantic-danger/25',
      },
      size: {
        sm: 'px-3.5 py-1.5 text-xs rounded-sm',
        default: 'px-5 py-2.5 text-sm rounded-md',
        lg: 'px-7 py-3.5 text-base rounded-md',
        icon: 'w-9 h-9 p-0 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }
