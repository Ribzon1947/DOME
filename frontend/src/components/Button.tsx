import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'kiosk'
  size?: 'md' | 'lg' | 'kiosk'
  children: ReactNode
}

const variants = {
  primary: 'bg-sky-600 hover:bg-sky-700 text-white',
  secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  kiosk: 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg',
}

const sizes = {
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
  kiosk: 'px-8 py-6 text-kiosk-lg rounded-2xl kiosk-touch-target',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`font-semibold transition disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
