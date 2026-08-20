export type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastPayload = {
  message: string;
  type?: ToastType;
  title?: string;
};

type ToastListener = (payload: ToastPayload) => void;

const listeners = new Set<ToastListener>();

export const toast = {
  show(message: string, type: ToastType = 'info', title?: string) {
    listeners.forEach((listener) => listener({ message, type, title }));
  },
  success(message: string, title?: string) {
    this.show(message, 'success', title);
  },
  error(message: string, title?: string) {
    this.show(message, 'error', title);
  },
  info(message: string, title?: string) {
    this.show(message, 'info', title);
  },
  warning(message: string, title?: string) {
    this.show(message, 'warning', title);
  },
  subscribe(listener: ToastListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
