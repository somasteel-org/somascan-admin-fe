import type { PropsWithChildren } from 'react'
import { Button } from '../ui/Button'

interface ModalProps extends PropsWithChildren {
  open: boolean
  title: string
  onClose: () => void
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
