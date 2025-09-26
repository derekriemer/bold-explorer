import { computed, reactive } from 'vue';
import type { AlertButton, AlertInput, AlertOptions } from '@ionic/core';
import type { OverlayEventDetail } from '@ionic/core/components';

type Awaitable<T> = T | Promise<T>;

export interface AlertDismissResult<TData = any>
{
  role: string;
  data: TData;
}

export interface AlertButtonContext<TPayload, TData = any>
{
  data: TData;
  payload: TPayload | undefined;
  close: () => void;
  dismiss: (result?: Partial<AlertDismissResult<TData>>) => void;
}

export type AlertButtonSpec<TPayload, TData = any> = Omit<AlertButton, 'handler'> & {
  handler?: (ctx: AlertButtonContext<TPayload, TData>) => Awaitable<boolean | void>;
};

export interface AlertBuildResult<TPayload, TData = any>
  extends Omit<AlertOptions, 'buttons' | 'inputs'>
{
  inputs?: AlertInput[];
  buttons: AlertButtonSpec<TPayload, TData>[];
}

type AlertBuilder<TPayload, TData = any> = (payload: TPayload | undefined) => AlertBuildResult<TPayload, TData>;

export function useAlertController<TKey extends string>()
{
  const builders = new Map<TKey, AlertBuilder<any, any>>();

  const state = reactive({
    isOpen: false,
    active: null as TKey | null,
    payload: undefined as unknown,
    config: null as AlertBuildResult<any, any> | null,
    buttons: null as AlertButton[] | null,
    resolve: null as ((result: AlertDismissResult) => void) | null,
    reject: null as ((reason?: unknown) => void) | null,
    manualResult: null as AlertDismissResult | null
  });

  function ensureBuilder (key: TKey): AlertBuilder<any, any>
  {
    const builder = builders.get(key);
    if (!builder)
    {
      throw new Error(`[useAlertController] Alert "${String(key)}" is not registered`);
    }
    return builder;
  }

  function register<TPayload, TData = any> (key: TKey, builder: AlertBuilder<TPayload, TData>): void
  {
    builders.set(key, builder as AlertBuilder<any, any>);
  }

  function open<TPayload, TData = any> (key: TKey, payload?: TPayload): Promise<AlertDismissResult<TData>>
  {
    const builder = ensureBuilder(key);
    const config = builder(payload);
    if (!config || !Array.isArray(config.buttons))
    {
      throw new Error(`[useAlertController] Alert "${String(key)}" must provide a buttons array`);
    }

    state.active = key;
    state.payload = payload;
    state.config = config;
    state.buttons = config.buttons.map(button => wrapButton(button, payload));
    state.manualResult = null;
    state.isOpen = true;

    return new Promise<AlertDismissResult<TData>>((resolve, reject) =>
    {
      state.resolve = resolve as (result: AlertDismissResult) => void;
      state.reject = reject as (reason?: unknown) => void;
    });
  }

  function wrapButton<TPayload, TData = any> (button: AlertButtonSpec<TPayload, TData>, payload: TPayload | undefined): AlertButton
  {
    const { handler, ...rest } = button;
    if (!handler)
    {
      return { ...rest } as AlertButton;
    }
    return {
      ...rest,
      handler (data: TData)
      {
        const ctx: AlertButtonContext<TPayload, TData> = {
          data,
          payload,
          close,
          dismiss (result)
          {
            state.manualResult = {
              role: result?.role ?? rest.role ?? 'confirm',
              data: Object.prototype.hasOwnProperty.call(result ?? {}, 'data') ? (result as AlertDismissResult<TData>).data : data
            } as AlertDismissResult<TData>;
            close();
          }
        };
        return handler(ctx);
      }
    };
  }

  function close (): void
  {
    state.isOpen = false;
  }

  function dismiss<TData = any> (result: Partial<AlertDismissResult<TData>> = {}): void
  {
    state.manualResult = {
      role: result.role ?? 'dismiss',
      data: (result as AlertDismissResult<TData>).data
    } as AlertDismissResult<TData>;
    close();
  }

  function onDidDismiss (event: CustomEvent<OverlayEventDetail>): void
  {
    const detail = event.detail;
    const resolved = state.manualResult ?? {
      role: detail?.role ?? 'dismiss',
      data: detail?.data
    };
    state.resolve?.(resolved);
    reset();
  }

  function reset (): void
  {
    state.isOpen = false;
    state.active = null;
    state.payload = undefined;
    state.config = null;
    state.buttons = null;
    state.resolve = null;
    state.reject = null;
    state.manualResult = null;
  }

  const current = computed(() =>
  {
    if (!state.config || !state.buttons) return null;
    const { buttons, ...rest } = state.config;
    return {
      ...rest,
      buttons: state.buttons
    };
  });

  const active = computed(() => state.active);
  const payload = computed(() => state.payload);
  const isOpen = computed(() => state.isOpen);

  return {
    register,
    open,
    close,
    dismiss,
    onDidDismiss,
    current,
    active,
    payload,
    isOpen
  };
}

export type UseAlertController = ReturnType<typeof useAlertController>;
