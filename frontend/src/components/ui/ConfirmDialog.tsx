'use client'

import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmLabel?: string
  loading?: boolean
  variant?: 'danger' | 'warning'
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Delete',
  loading = false,
  variant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="sm">
      <p className="text-sm text-text-secondary">{message}</p>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          disabled={loading}
          className="btn-secondary text-sm px-4 py-2"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`text-sm px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 ${
            variant === 'danger'
              ? 'bg-churn-red text-white hover:bg-red-600'
              : 'bg-warning text-black hover:bg-yellow-400'
          }`}
        >
          {loading ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
