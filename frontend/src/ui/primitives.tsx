/**
 * Primitivos de apresentação. Sem regra de negócio aqui — só forma.
 * Estilo shadcn/ui: Radix para comportamento, CVA para variantes, tokens para cor.
 */

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Info } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Button */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium ' +
    'transition-all duration-150 ease-swift disabled:pointer-events-none disabled:opacity-45 ' +
    '[&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white shadow-card hover:bg-accent-ink active:translate-y-px',
        secondary:
          'border border-line bg-surface text-ink hover:border-line-strong hover:bg-subtle',
        ghost: 'text-ink-muted hover:bg-subtle hover:text-ink',
        subtle: 'bg-subtle text-ink hover:bg-line',
        danger: 'border border-danger/30 text-danger hover:bg-danger/10',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-sm',
        lg: 'h-9 px-4 text-sm',
        icon: 'h-8 w-8',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'

/* -------------------------------------------------------------------- Card */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('card', className)} {...props} />
  ),
)
Card.displayName = 'Card'

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-snug text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------- Badge */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-medium ' +
    'leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-line bg-subtle text-ink-muted',
        outline: 'border-line-strong bg-transparent text-ink-muted',
        accent: 'border-accent/25 bg-accent-soft text-accent-ink',
        positive: 'border-positive/25 bg-positive/10 text-positive',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        danger: 'border-danger/30 bg-danger/10 text-danger',
        info: 'border-info/25 bg-info/10 text-info',
        /* Inferência tem contorno pontilhado: o usuário vê que o dado é derivado. */
        inferred: 'border-dashed border-warning/50 bg-transparent text-warning',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

// forwardRef e obrigatorio: Badge e usado como trigger de Tooltip com `asChild`,
// e o Radix precisa da ref para posicionar o popper.
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
)
Badge.displayName = 'Badge'

/* ----------------------------------------------------------------- Tooltip */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={80}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
}: {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  if (!content) return <>{children}</>
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-md border border-line bg-elevated px-2.5 py-2 text-xs',
            'leading-snug text-ink shadow-overlay',
            'data-[state=delayed-open]:animate-fade-in',
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[hsl(var(--elevated))]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        aria-label="Mais informação"
        className="inline-flex size-4 items-center justify-center rounded-sm text-ink-faint
                   transition-colors hover:text-ink-muted"
      >
        <Info className="size-3.5" />
      </button>
    </Tooltip>
  )
}

/* ----------------------------------------------------------------- Popover */
export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-64 rounded-lg border border-line bg-elevated p-1 shadow-overlay',
          'data-[state=open]:animate-slide-up',
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

/* ---------------------------------------------------------------- Checkbox */
export function Checkbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer size-4 shrink-0 rounded-sm border border-line-strong transition-colors',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/* --------------------------------------------------------------- Separator */
export function Separator({
  className,
  orientation = 'horizontal',
}: {
  className?: string
  orientation?: 'horizontal' | 'vertical'
}) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  )
}

/* ------------------------------------------------------------------ Inputs */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-8 w-full rounded border border-line bg-surface px-2.5 text-sm text-ink',
      'placeholder:text-ink-faint transition-colors',
      'hover:border-line-strong focus:border-accent focus:outline-none',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-8 rounded border border-line bg-surface px-2 pr-7 text-sm text-ink',
        'transition-colors hover:border-line-strong focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

/* --------------------------------------------------------------- Skeletons */
export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={cn('skeleton', className)} style={style} />
}

export function SkeletonCard({ height = 'h-64' }: { height?: string }) {
  return (
    <Card className={cn('flex flex-col', height)}>
      <div className="border-b border-line px-4 py-3">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-2 h-2.5 w-56" />
      </div>
      <div className="flex flex-1 items-end gap-2 p-4">
        {[45, 70, 35, 85, 55, 65, 40, 75].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ States */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-ink-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  action,
  hint,
}: {
  title?: string
  message?: string
  action?: React.ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/[0.04] px-5 py-6">
      <p className="text-sm font-semibold text-danger">{title}</p>
      {message ? <p className="mt-1.5 text-xs leading-relaxed text-ink">{message}</p> : null}
      {hint ? (
        <pre className="mt-3 overflow-x-auto rounded border border-line bg-surface px-2.5 py-2 font-mono text-2xs text-ink-muted">
          {hint}
        </pre>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
