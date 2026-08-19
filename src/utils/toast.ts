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
  subscribe(listener: ToastListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
