import { useEffect, useState } from 'react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info' | 'success'
}

interface ConfirmModalProps {
  isOpen: boolean
  options: ConfirmOptions | null
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ isOpen, options, onConfirm, onCancel }: ConfirmModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  if (!isOpen || !options) return null

  const typeStyles = {
    danger: {
      icon: '⚠️',
      iconBg: 'bg-red-500/10',
      iconBorder: 'border-red-500/30',
      confirmBg: 'bg-red-500 hover:bg-red-600',
    },
    warning: {
      icon: '⚠️',
      iconBg: 'bg-yellow-500/10',
      iconBorder: 'border-yellow-500/30',
      confirmBg: 'bg-yellow-500 hover:bg-yellow-600 text-black',
    },
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-500/10',
      iconBorder: 'border-blue-500/30',
      confirmBg: 'bg-primary hover:bg-primary-hover',
    },
    success: {
      icon: '✅',
      iconBg: 'bg-green-500/10',
      iconBorder: 'border-green-500/30',
      confirmBg: 'bg-green-500 hover:bg-green-600',
    },
  }

  const style = typeStyles[options.type || 'info']

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onCancel}
      />
      <div
        className={`relative glass-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        <div className="flex flex-col items-center text-center mb-4">
          <div className={`w-14 h-14 rounded-full ${style.iconBg} border ${style.iconBorder} flex items-center justify-center mb-3`}>
            <span className="text-2xl">{style.icon}</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">{options.title}</h3>
          <p className="text-zinc-400 text-sm whitespace-pre-wrap">{options.message}</p>
        </div>

        <div className="flex gap-3 mt-6">
          {options.cancelText !== undefined && (
            <button
              onClick={onCancel}
              className="flex-1 bg-surface hover:bg-surface-hover text-zinc-300 font-semibold py-2.5 rounded-lg transition-all border border-border"
            >
              {options.cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 ${style.confirmBg} text-white font-semibold py-2.5 rounded-lg transition-all`}
          >
            {options.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}