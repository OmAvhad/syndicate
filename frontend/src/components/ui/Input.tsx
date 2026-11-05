import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-md text-sm text-text-primary placeholder:text-text-muted/60 transition-colors duration-fast ease-standard',
            'border border-border bg-surface-raised focus:border-accent focus:bg-surface focus:outline-none',
            error && 'border-semantic-danger focus:border-semantic-danger',
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
        {error && <p className="text-xs text-semantic-danger font-medium">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {label}
          </label>
        )}
        <textarea
          id={id}
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-md text-sm text-text-primary placeholder:text-text-muted/60 transition-colors duration-fast ease-standard resize-none',
            'border border-border bg-surface-raised focus:border-accent focus:bg-surface focus:outline-none',
            error && 'border-semantic-danger focus:border-semantic-danger',
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
        {error && <p className="text-xs text-semantic-danger font-medium">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Input, Textarea }
