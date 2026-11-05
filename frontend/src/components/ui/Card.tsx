import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'raised'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border p-6 transition-colors duration-fast ease-standard',
        variant === 'raised'
          ? 'bg-surface-raised'
          : 'bg-surface hover:border-border-strong',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 mb-5', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-bold text-text-primary tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-text-muted leading-relaxed', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-text-secondary text-sm', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
