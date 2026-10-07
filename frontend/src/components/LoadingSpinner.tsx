import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'medium', message, className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      ...className ? {} : {}
    }} className={className}>
      <Loader2 
        className="loading-spinner" 
        size={size === 'small' ? 16 : size === 'medium' ? 32 : 48} 
      />
      {message && <p style={{ color: 'var(--color-text-muted)', fontSize: size === 'large' ? '16px' : '14px', margin: 0 }}>{message}</p>}
    </div>
  );
}