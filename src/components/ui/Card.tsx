import type { PropsWithChildren } from 'react'
import { cn } from '../../utils/cn'

interface CardProps extends PropsWithChildren {
  className?: string
}

export function Card({ className, children }: CardProps) {
  return <div className={cn('rounded-xl border border-zinc-200 bg-white p-4 shadow-sm', className)}>{children}</div>
}
