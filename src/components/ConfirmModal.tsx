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

function getIcon(type: string) {
  switch (type) {
    case 'danger':
      return (
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    case 'warning':
      return (
        <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    case 'success':
      return (
        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    default: // info
      return (
        <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
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
      iconBg: 'bg-red-500/10',
      iconBorder: 'border-red-500/30',
      confirmBg: 'bg-red-500 hover:bg-red-600',
    },
    warning: {
      iconBg: 'bg-yellow-500/10',
      iconBorder: 'border-yellow-500/30',
      confirmBg: 'bg-yellow-500 hover:bg-yellow-600 text-black',
    },
    info: {
      iconBg: 'bg-blue-500/10',
      iconBorder: 'border-blue-500/30',
      confirmBg: 'bg-primary hover:bg-primary-hover',
    },
    success: {
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
            {getIcon(options.type || 'info')}
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