import { useEffect } from 'react';

interface StatusMessageProps {
  message: string;
  type: 'success' | 'error';
  duration?: number;
  onDismiss: () => void;
}

export function StatusMessage({
  message,
  type,
  duration = 3000,
  onDismiss,
}: StatusMessageProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const styles =
    type === 'success'
      ? 'bg-sd-success/20 border-sd-success text-sd-success'
      : 'bg-sd-error/20 border-sd-error text-sd-error';

  return (
    <div className={`p-2 rounded text-[11px] border ${styles}`}>{message}</div>
  );
}
