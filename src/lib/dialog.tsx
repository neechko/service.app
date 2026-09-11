import { createRoot } from 'react-dom/client'
import ConfirmModal, { ConfirmOptions } from '../components/ConfirmModal'
import { useState, useEffect } from 'react'

// ============================================================
// SHOW CONFIRM - Menggantikan window.confirm()
// ============================================================
export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const handleClose = (result: boolean) => {
      root.unmount()
      container.remove()
      resolve(result)
    }

    root.render(
      <ConfirmModal
        isOpen={true}
        options={options}
        onConfirm={() => handleClose(true)}
        onCancel={() => handleClose(false)}
      />
    )
  })
}

// ============================================================
// SHOW ALERT - Menggantikan window.alert()
// ============================================================
export function showAlert(options: {
  title: string
  message: string
  type?: 'danger' | 'warning' | 'info' | 'success'
}): Promise<void> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const handleClose = () => {
      root.unmount()
      container.remove()
      resolve()
    }

    root.render(
      <ConfirmModal
        isOpen={true}
        options={{
          ...options,
          confirmText: 'OK',
          cancelText: undefined,
        }}
        onConfirm={handleClose}
        onCancel={handleClose}
      />
    )
  })
}

// ============================================================
// SHOW PROMPT - Menggantikan window.prompt()
// ============================================================
interface PromptOptions {
  title: string
  message: string
  defaultValue?: string
  placeholder?: string
}

interface PromptModalProps {
  isOpen: boolean
  options: PromptOptions
  onSubmit: (value: string) => void
  onCancel: () => void
}

function PromptModal({ isOpen, options, onSubmit, onCancel }: PromptModalProps) {
  const [value, setValue] = useState(options.defaultValue || '')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
      setValue(options.defaultValue || '')
    } else {
      setIsVisible(false)
    }
  }, [isOpen, options.defaultValue])

  if (!isOpen) return null

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
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
            <span className="text-2xl">💬</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">{options.title}</h3>
          <p className="text-zinc-400 text-sm">{options.message}</p>
        </div>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={options.placeholder}
          className="input-modern w-full mt-4"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit(value)
            if (e.key === 'Escape') onCancel()
          }}
        />

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 bg-surface hover:bg-surface-hover text-zinc-300 font-semibold py-2.5 rounded-lg transition-all border border-border"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(value)}
            className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg transition-all"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

export function showPrompt(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const handleClose = (result: string | null) => {
      root.unmount()
      container.remove()
      resolve(result)
    }

    root.render(
      <PromptModal
        isOpen={true}
        options={options}
        onSubmit={handleClose}
        onCancel={() => handleClose(null)}
      />
    )
  })
}