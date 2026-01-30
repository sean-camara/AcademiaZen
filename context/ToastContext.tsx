import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { IconX } from '../components/Icons';
import { generateId } from '../utils/helpers';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type ToastOptions = {
  id?: string;
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  dismissible?: boolean;
  dedupeKey?: string;
};

type ToastRecord = {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration: number;
  remaining: number;
  createdAt: number;
  paused: boolean;
  dismissible: boolean;
  dedupeKey: string;
};

type ToastState = {
  toasts: ToastRecord[];
  queue: ToastRecord[];
};

type ToastAction =
  | { type: 'ADD'; toast: ToastRecord }
  | { type: 'DISMISS'; id: string }
  | { type: 'UPDATE'; id: string; updates: Partial<ToastOptions> }
  | { type: 'PAUSE'; id: string }
  | { type: 'RESUME'; id: string }
  | { type: 'CLEAR' }
  | { type: 'TICK'; delta: number };

type ToastContextValue = {
  show: (options: ToastOptions) => string;
  success: (message: string, options?: Partial<ToastOptions>) => string;
  error: (message: string, options?: Partial<ToastOptions>) => string;
  warning: (message: string, options?: Partial<ToastOptions>) => string;
  info: (message: string, options?: Partial<ToastOptions>) => string;
  loading: (message: string, options?: Partial<ToastOptions>) => string;
  update: (id: string, updates: Partial<ToastOptions>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3000;
const MAX_VISIBLE = 4;
const TICK_MS = 100;

const getDedupeKey = (type: ToastType, message: string, dedupeKey?: string) => {
  return (dedupeKey || `${type}:${message}`).toLowerCase();
};

const normalizeMessage = (message: string) => message.trim();

const reducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case 'ADD': {
      if (state.toasts.length < MAX_VISIBLE) {
        return { ...state, toasts: [...state.toasts, action.toast] };
      }
      return { ...state, queue: [...state.queue, action.toast] };
    }
    case 'DISMISS': {
      const remainingToasts = state.toasts.filter((toast) => toast.id !== action.id);
      const remainingQueue = state.queue.filter((toast) => toast.id !== action.id);

      if (remainingToasts.length === state.toasts.length) {
        return { ...state, queue: remainingQueue };
      }

      const slots = MAX_VISIBLE - remainingToasts.length;
      if (slots > 0 && remainingQueue.length > 0) {
        const next = remainingQueue.slice(0, slots);
        return {
          toasts: [...remainingToasts, ...next],
          queue: remainingQueue.slice(slots),
        };
      }
      return { ...state, toasts: remainingToasts, queue: remainingQueue };
    }
    case 'UPDATE': {
      const applyUpdates = (toast: ToastRecord) => {
        const nextType = (action.updates.type || toast.type) as ToastType;
        let nextDuration = action.updates.duration ?? toast.duration;
        if (toast.type === 'loading' && nextType !== 'loading' && action.updates.duration == null) {
          nextDuration = DEFAULT_DURATION;
        }
        if (nextType === 'loading') {
          nextDuration = 0;
        }
        const nextMessage = action.updates.message ?? toast.message;
        const nextTitle = action.updates.title ?? toast.title;
        const nextDismissible = action.updates.dismissible ?? (nextType === 'loading' ? false : toast.dismissible);
        const nextDedupeKey = getDedupeKey(nextType, nextMessage, action.updates.dedupeKey ?? toast.dedupeKey);
        const shouldResetTimer = action.updates.duration !== undefined || toast.duration === 0 || toast.type === 'loading';
        const nextRemaining = nextDuration === 0 ? 0 : shouldResetTimer ? nextDuration : toast.remaining;

        return {
          ...toast,
          type: nextType,
          duration: nextDuration,
          remaining: nextRemaining,
          message: nextMessage,
          title: nextTitle,
          dismissible: nextDismissible,
          dedupeKey: nextDedupeKey,
        };
      };

      return {
        ...state,
        toasts: state.toasts.map((toast) => (toast.id === action.id ? applyUpdates(toast) : toast)),
        queue: state.queue.map((toast) => (toast.id === action.id ? applyUpdates(toast) : toast)),
      };
    }
    case 'PAUSE': {
      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === action.id ? { ...toast, paused: true } : toast
        ),
      };
    }
    case 'RESUME': {
      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === action.id ? { ...toast, paused: false } : toast
        ),
      };
    }
    case 'CLEAR': {
      return { toasts: [], queue: [] };
    }
    case 'TICK': {
      const updatedToasts: ToastRecord[] = [];
      state.toasts.forEach((toast) => {
        if (toast.duration === 0 || toast.paused) {
          updatedToasts.push(toast);
          return;
        }
        const remaining = toast.remaining - action.delta;
        if (remaining > 0) {
          updatedToasts.push({ ...toast, remaining });
        }
      });

      const slots = MAX_VISIBLE - updatedToasts.length;
      if (slots > 0 && state.queue.length > 0) {
        const next = state.queue.slice(0, slots);
        return {
          toasts: [...updatedToasts, ...next],
          queue: state.queue.slice(slots),
        };
      }
      return { ...state, toasts: updatedToasts };
    }
    default:
      return state;
  }
};

const toastStyles: Record<
  ToastType,
  { label: string; labelText: string; dot: string; bar: string; spinner: string }
> = {
  success: {
    label: 'Success',
    labelText: 'text-emerald-300',
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-400',
    spinner: 'border-emerald-400',
  },
  error: {
    label: 'Error',
    labelText: 'text-red-300',
    dot: 'bg-red-400',
    bar: 'bg-red-400',
    spinner: 'border-red-400',
  },
  warning: {
    label: 'Warning',
    labelText: 'text-amber-300',
    dot: 'bg-amber-400',
    bar: 'bg-amber-400',
    spinner: 'border-amber-400',
  },
  info: {
    label: 'Info',
    labelText: 'text-zen-primary',
    dot: 'bg-zen-primary',
    bar: 'bg-zen-primary',
    spinner: 'border-zen-primary',
  },
  loading: {
    label: 'Loading',
    labelText: 'text-sky-300',
    dot: 'bg-sky-400',
    bar: 'bg-sky-400',
    spinner: 'border-sky-400',
  },
};

const ToastViewport: React.FC<{
  state: ToastState;
  dispatch: React.Dispatch<ToastAction>;
}> = ({ state, dispatch }) => {
  if (state.toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50 flex w-[92vw] max-w-[92vw] flex-col-reverse gap-3 sm:w-[360px]">
      {state.toasts.map((toast) => {
        const style = toastStyles[toast.type];
        const progress =
          toast.duration > 0 ? Math.max(0, Math.min(1, toast.remaining / toast.duration)) : 0;
        const live = toast.type === 'error' ? 'assertive' : 'polite';
        const role = toast.type === 'error' ? 'alert' : 'status';

        return (
          <div
            key={toast.id}
            role={role}
            aria-live={live}
            aria-atomic="true"
            onMouseEnter={() => dispatch({ type: 'PAUSE', id: toast.id })}
            onMouseLeave={() => dispatch({ type: 'RESUME', id: toast.id })}
            onFocus={() => dispatch({ type: 'PAUSE', id: toast.id })}
            onBlur={() => dispatch({ type: 'RESUME', id: toast.id })}
            className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-zen-surface/80 bg-zen-card/95 backdrop-blur shadow-2xl shadow-black/40 animate-reveal"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="mt-1 flex h-2.5 w-2.5 items-center justify-center">
                {toast.type === 'loading' ? (
                  <span
                    className={`h-2.5 w-2.5 rounded-full border-2 border-t-transparent ${style.spinner} animate-spin`}
                  />
                ) : (
                  <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${style.labelText}`}>
                  {toast.title || style.label}
                </p>
                <p className="text-sm text-zen-text-primary break-words">{toast.message}</p>
              </div>
              {toast.dismissible && (
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dispatch({ type: 'DISMISS', id: toast.id })}
                  className="rounded-full p-1 text-zen-text-disabled hover:text-zen-text-primary hover:bg-zen-surface/60 transition-colors"
                >
                  <IconX className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="h-1 w-full bg-zen-surface/60">
              {toast.duration > 0 ? (
                <div
                  className={`${style.bar} h-full transition-[width] duration-100 ease-linear`}
                  style={{ width: `${progress * 100}%` }}
                />
              ) : (
                <div className={`${style.bar} h-full w-1/3 animate-pulse`} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, { toasts: [], queue: [] });
  const stateRef = useRef(state);
  const pendingKeysRef = useRef<Map<string, string>>(new Map());
  const pendingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    stateRef.current = state;
    pendingKeysRef.current.clear();
    pendingIdsRef.current.clear();
  }, [state]);

  useEffect(() => {
    const hasActiveToast = state.toasts.some((toast) => toast.duration > 0 && !toast.paused);
    if (!hasActiveToast) return;
    const interval = window.setInterval(() => {
      dispatch({ type: 'TICK', delta: TICK_MS });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [state.toasts]);

  const show = useCallback(
    (options: ToastOptions) => {
      const message = normalizeMessage(options.message || '');
      if (!message) return '';

      const type = options.type ?? 'info';
      const id = options.id ?? generateId();
      const dedupeKey = getDedupeKey(type, message, options.dedupeKey);

      if (pendingIdsRef.current.has(id)) {
        return id;
      }
      const pendingKeyId = pendingKeysRef.current.get(dedupeKey);
      if (pendingKeyId) {
        return pendingKeyId;
      }

      const current = stateRef.current;
      const existing = [...current.toasts, ...current.queue].find(
        (toast) => toast.id === id || toast.dedupeKey === dedupeKey
      );

      if (existing) {
        if (existing.id === id) {
          dispatch({ type: 'UPDATE', id, updates: { ...options, message, type } });
        }
        return existing.id;
      }

      const duration = type === 'loading' ? 0 : Math.max(0, options.duration ?? DEFAULT_DURATION);
      const dismissible = options.dismissible ?? type !== 'loading';

      pendingKeysRef.current.set(dedupeKey, id);
      pendingIdsRef.current.add(id);

      dispatch({
        type: 'ADD',
        toast: {
          id,
          title: options.title,
          message,
          type,
          duration,
          remaining: duration,
          createdAt: Date.now(),
          paused: false,
          dismissible,
          dedupeKey,
        },
      });

      return id;
    },
    [dispatch]
  );

  const update = useCallback(
    (id: string, updates: Partial<ToastOptions>) => {
      if (!id) return;
      dispatch({ type: 'UPDATE', id, updates });
    },
    [dispatch]
  );

  const dismiss = useCallback(
    (id: string) => {
      if (!id) return;
      dispatch({ type: 'DISMISS', id });
    },
    [dispatch]
  );

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, [dispatch]);

  const api = useMemo<ToastContextValue>(() => {
    return {
      show,
      success: (message, options) => show({ ...options, message, type: 'success' }),
      error: (message, options) => show({ ...options, message, type: 'error' }),
      warning: (message, options) => show({ ...options, message, type: 'warning' }),
      info: (message, options) => show({ ...options, message, type: 'info' }),
      loading: (message, options) => show({ ...options, message, type: 'loading', dismissible: false }),
      update,
      dismiss,
      clear,
    };
  }, [show, update, dismiss, clear]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport state={state} dispatch={dispatch} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
