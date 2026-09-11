import { useEffect, useState } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info" | "success";
}

interface ConfirmModalProps {
  isOpen: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  options,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen || !options) return null;

  const typeStyles = {
    danger: {
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      ),
      iconBg: "bg-red-500/10",
      iconBorder: "border-red-500/30",
      confirmBg: "bg-red-500 hover:bg-red-600",
    },
    warning: {
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
      ),
      iconBg: "bg-amber-500/10",
      iconBorder: "border-amber-500/30",
      confirmBg: "bg-amber-500 hover:bg-amber-600 text-black",
    },
    info: {
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="16" y2="12" />
          <line x1="12" x2="12.01" y1="8" y2="8" />
        </svg>
      ),
      iconBg: "bg-blue-500/10",
      iconBorder: "border-blue-500/30",
      confirmBg: "bg-primary hover:bg-primary-hover",
    },
    success: {
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      iconBg: "bg-emerald-500/10",
      iconBorder: "border-emerald-500/30",
      confirmBg: "bg-emerald-500 hover:bg-emerald-600",
    },
  };

  const style = typeStyles[options.type || "info"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onCancel}
      />
      <div
        className={`relative glass-card rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl transition-all duration-300 ${
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
        }`}
      >
        <div className="flex flex-col items-center text-center mb-4">
          <div
            className={`w-14 h-14 rounded-full ${style.iconBg} border ${style.iconBorder} flex items-center justify-center mb-3`}
          >
            <span className="text-2xl">{style.icon}</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">{options.title}</h3>
          <p className="text-zinc-400 text-sm whitespace-pre-wrap">
            {options.message}
          </p>
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
            {options.confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
