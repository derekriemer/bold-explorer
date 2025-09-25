import { ref } from 'vue';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

interface PermissionAlertOptions {
  header?: string;
  message: string;
}

const DEFAULT_HEADER = 'Enable Permissions';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

async function openBackgroundSettings (): Promise<boolean>
{
  try
  {
    if (!Capacitor.isNativePlatform()) return false;
    if (!Capacitor.isPluginAvailable('BackgroundGeolocation')) return false;
    await BackgroundGeolocation.openSettings();
    return true;
  }
  catch (err)
  {
    console.warn('[usePermissionAlert] background plugin openSettings failed', err);
    return true; // treat as handled to avoid double dialogs
  }
}

export function usePermissionAlert(initial: PermissionAlertOptions | null = null)
{
  const isOpen = ref(false);
  const header = ref(initial?.header ?? DEFAULT_HEADER);
  const message = ref(initial?.message ?? '');

  function show (opts: PermissionAlertOptions): void
  {
    header.value = opts.header ?? DEFAULT_HEADER;
    message.value = opts.message;
    isOpen.value = true;
  }

  function dismiss (): void
  {
    isOpen.value = false;
  }

  async function openSettings (): Promise<void>
  {
    try
    {
      const handled = await openBackgroundSettings();
      const appOpenSettings = (App as any)?.openSettings;
      if (!handled && typeof appOpenSettings === 'function')
      {
        await appOpenSettings();
      }
      else if (!handled)
      {
        console.warn('[usePermissionAlert] App.openSettings is unavailable on this platform');
      }
    }
    catch (err)
    {
      console.warn('[usePermissionAlert] openSettings failed', err);
    }
    finally
    {
      dismiss();
    }
  }

  if (initial?.message)
  {
    show(initial);
  }

  return {
    isOpen,
    header,
    message,
    show,
    dismiss,
    openSettings
  };
}

export type UsePermissionAlert = ReturnType<typeof usePermissionAlert>;
