import { useEffect } from 'react';

interface StatusMessageProps {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
}

const TYPE_STYLES: Record<StatusMessageProps['type'], string> = {
  success: 'bg-sd-success/20 border-sd-success text-sd-success',
  error: 'bg-sd-error/20 border-sd-error text-sd-error',
  info: 'bg-sd-focus/20 border-sd-focus text-sd-focus',
};

export function StatusMessage({
  message,
  type,
  duration = 3000,
  onDismiss,
}: StatusMessageProps) {
  useEffect(() => {
    // info messages persist — no auto-dismiss
    if (!onDismiss || type === 'info') return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, type]);

  return (
    <div className={`p-2 rounded text-[11px] border ${TYPE_STYLES[type]}`}>
      {message}
    </div>
  );
}
