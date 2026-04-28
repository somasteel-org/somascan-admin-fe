import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-[#F2B841]',
        className,
      )}
      {...props}
    />
  )
}
