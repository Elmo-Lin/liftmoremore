import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 select-none'

const variants: Record<Variant, string> = {
  // HIG-style: filled (blue), tinted gray "bordered" (blue label), plain (blue text).
  primary: 'bg-accent-600 text-white font-semibold hover:bg-accent-700 active:bg-accent-800',
  accent: 'bg-accent-600 text-white font-semibold hover:bg-accent-700 active:bg-accent-800',
  secondary: 'bg-fill text-accent-700 hover:bg-[#7676802e] active:bg-[#76768038]',
  ghost: 'text-accent-700 hover:bg-fill',
  subtle: 'bg-fill text-ink-800 hover:bg-[#7676802e]',
  danger: 'bg-danger-600 text-white font-semibold hover:bg-danger-600/90',
  destructive: 'text-danger-600 hover:bg-danger-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 rounded-full px-3.5 text-[13px]',
  md: 'h-10 px-4 text-[15px]',
  lg: 'h-[50px] rounded-xl px-5 text-[17px]',
}

function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  children?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, className = '', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2} />}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
}

export function ButtonLink({ variant = 'primary', size = 'md', icon: Icon, className = '', children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2} />}
      {children}
    </Link>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  tone?: 'default' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function IconButton({ icon: Icon, label, tone = 'default', size = 'md', className = '', ...rest }: IconButtonProps) {
  const dim = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-11' : 'size-9'
  const toneCls = tone === 'danger' ? 'text-ink-400 hover:bg-danger-50 hover:text-danger-600' : 'text-ink-500 hover:bg-subtle hover:text-ink-900'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40 ${toneCls} ${className}`}
      {...rest}
    >
      <Icon className="size-4" />
    </button>
  )
}
