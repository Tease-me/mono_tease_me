export type ErrorModalPayload = {
  title?: string;
  message: string;
  status?: number;
};

type ErrorModalListener = (payload: ErrorModalPayload) => void;

const listeners = new Set<ErrorModalListener>();

export const subscribeErrorModal = (listener: ErrorModalListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const showErrorModal = (payload: ErrorModalPayload) => {
  listeners.forEach((listener) => listener(payload));
};
