import { computed, ref } from 'vue';
import type { AlertButton, AlertInput, AlertOptions } from '@ionic/vue';

type Awaitable<T> = T | Promise<T>;

export interface AlertDismissResult<TData = any> {
  role: string;
  data: TData;
}

export interface AlertButtonContext<TPayload, TData = any> {
  data: TData;
  payload: TPayload | undefined;
  close: () => void;
  dismiss: (result?: Partial<AlertDismissResult<TData>>) => void;
}

export type AlertButtonSpec<TPayload, TData = any> = Omit<AlertButton, 'handler'> & {
  handler?: (ctx: AlertButtonContext<TPayload, TData>) => Awaitable<boolean | void>;
};

export interface AlertBuildResult<TPayload, TData = any>
  extends Omit<AlertOptions, 'buttons' | 'inputs'> {
  inputs?: AlertInput[];
  buttons: AlertButtonSpec<TPayload, TData>[];
}

type AlertBuilder<TPayload, TData = any> = (
  payload: TPayload | undefined
) => AlertBuildResult<TPayload, TData>;

type AlertView<TData = any> = Omit<AlertOptions, 'buttons' | 'inputs'> & {
  inputs?: AlertInput[];
  buttons: AlertButton[];
};

interface AlertOverlayEventDetail<T = any> {
  data?: T;
  role?: string;
}

export function useAlertController<TKey extends string>() {
  const builders = new Map<TKey, AlertBuilder<any, any>>();
  const isOpenRef = ref(false);
  const activeKey = ref<TKey | null>(null);
  const payloadRef = ref<unknown>(undefined);
  const configRef = ref<AlertBuildResult<any, any> | null>(null);
  const buttonsRef = ref<AlertButton[] | null>(null);
  const resolveRef = ref<((result: AlertDismissResult) => void) | null>(null);
  const rejectRef = ref<((reason?: unknown) => void) | null>(null);
  const manualResultRef = ref<AlertDismissResult | null>(null);

  function ensureBuilder(key: TKey): AlertBuilder<any, any> {
    const builder = builders.get(key);
    if (!builder) {
      throw new Error(`[useAlertController] Alert "${String(key)}" is not registered`);
    }
    return builder;
  }

  function register<TPayload, TData = any>(
    key: TKey,
    builder: AlertBuilder<TPayload, TData>
  ): void {
    builders.set(key, builder as AlertBuilder<any, any>);
  }

  function open<TPayload, TData = any>(
    key: TKey,
    payload?: TPayload
  ): Promise<AlertDismissResult<TData>> {
    const builder = ensureBuilder(key);
    const config = builder(payload);
    if (!config || !Array.isArray(config.buttons)) {
      throw new Error(`[useAlertController] Alert "${String(key)}" must provide a buttons array`);
    }

    activeKey.value = key;
    payloadRef.value = payload as unknown;
    configRef.value = config;
    buttonsRef.value = config.buttons.map((button) => wrapButton(button, payload));
    manualResultRef.value = null;
    isOpenRef.value = true;

    return new Promise<AlertDismissResult<TData>>((resolve, reject) => {
      resolveRef.value = resolve as (result: AlertDismissResult) => void;
      rejectRef.value = reject as (reason?: unknown) => void;
    });
  }

  function wrapButton<TPayload, TData = any>(
    button: AlertButtonSpec<TPayload, TData>,
    payload: TPayload | undefined
  ): AlertButton {
    const { handler, ...rest } = button;
    if (!handler) {
      return { ...rest } as AlertButton;
    }
    return {
      ...rest,
      handler(data: TData) {
        const ctx: AlertButtonContext<TPayload, TData> = {
          data,
          payload,
          close,
          dismiss(result) {
            manualResultRef.value = {
              role: result?.role ?? rest.role ?? 'confirm',
              data: Object.prototype.hasOwnProperty.call(result ?? {}, 'data')
                ? (result as AlertDismissResult<TData>).data
                : data,
            } as AlertDismissResult<TData>;
            close();
          },
        };
        return handler(ctx);
      },
    };
  }

  function close(): void {
    isOpenRef.value = false;
  }

  function dismiss<TData = any>(result: Partial<AlertDismissResult<TData>> = {}): void {
    manualResultRef.value = {
      role: result.role ?? 'dismiss',
      data: (result as AlertDismissResult<TData>).data,
    } as AlertDismissResult<TData>;
    close();
  }

  function onDidDismiss(event: CustomEvent<AlertOverlayEventDetail>): void {
    const detail = event.detail;
    const resolved = manualResultRef.value ?? {
      role: detail?.role ?? 'dismiss',
      data: detail?.data,
    };
    resolveRef.value?.(resolved);
    reset();
  }

  function reset(): void {
    isOpenRef.value = false;
    activeKey.value = null;
    payloadRef.value = undefined;
    configRef.value = null;
    buttonsRef.value = null;
    resolveRef.value = null;
    rejectRef.value = null;
    manualResultRef.value = null;
  }

  const current = computed<AlertView | null>(() => {
    const config = configRef.value;
    const buttons = buttonsRef.value;
    if (!config || !buttons) {
      return null;
    }
    const { buttons: _ignored, ...rest } = config;
    return {
      ...rest,
      buttons,
    };
  });

  const active = computed(() => activeKey.value);
  const payload = computed(() => payloadRef.value);
  const isOpen = computed(() => isOpenRef.value);

  return {
    register,
    open,
    close,
    dismiss,
    onDidDismiss,
    current,
    active,
    payload,
    isOpen,
  };
}

export type UseAlertController = ReturnType<typeof useAlertController>;
