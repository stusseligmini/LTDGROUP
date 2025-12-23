// Basic toast notification hook
import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
}

interface ToastState {
  toasts: Toast[];
}

let toastIdCounter = 0;

const useToastState = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${++toastIdCounter}`;
    const newToast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
    
    return id;
  }, []);
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  return { toasts, addToast, removeToast };
};

// Simple toast hook
export function useToast() {
  const toast = useCallback((options: {
    title: string;
    description?: string;
    variant?: 'default' | 'success' | 'error' | 'warning';
  }) => {
    // For now, log to structured logger - can be enhanced with actual toast UI later
    const logLevel = options.variant === 'error' ? 'error' : 
                     options.variant === 'warning' ? 'warn' : 
                     'info';
    
    if (logLevel === 'error') {
      logger.error(options.title, undefined, { description: options.description });
    } else if (logLevel === 'warn') {
      logger.warn(options.title, { description: options.description });
    } else {
      logger.info(options.title, { description: options.description });
    }
    
    // Return toast object for consistency
    return {
      id: `toast-${Date.now()}`,
      title: options.title,
      description: options.description,
      variant: options.variant || 'default'
    };
  }, []);
  
  return { toast };
}
