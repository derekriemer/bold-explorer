import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermissionAlert } from '@/composables/usePermissionAlert';
import { App } from '@capacitor/app';

const mocks = vi.hoisted(() => {
  const openSettingsMock = vi.fn<[], Promise<void>>();
  const registerPluginMock = vi.fn(() => ({ openSettings: openSettingsMock }));
  const isNativePlatformMock = vi.fn(() => true);
  const isPluginAvailableMock = vi.fn(() => true);
  return { openSettingsMock, registerPluginMock, isNativePlatformMock, isPluginAvailableMock };
});

vi.mock('@capacitor/app', () => {
  const { openSettingsMock } = mocks;
  return {
    App: { openSettings: vi.fn(() => Promise.resolve()) },
    __openSettingsMock: openSettingsMock
  } as any;
});

vi.mock('@capacitor/core', () => {
  const { registerPluginMock, isNativePlatformMock, isPluginAvailableMock } = mocks;
  return {
    Capacitor: {
      isNativePlatform: isNativePlatformMock,
      isPluginAvailable: isPluginAvailableMock
    },
    registerPlugin: registerPluginMock
  };
});

const { openSettingsMock, registerPluginMock, isNativePlatformMock, isPluginAvailableMock } = mocks;

describe('usePermissionAlert', () =>
{
  beforeEach(() =>
  {
    openSettingsMock.mockReset();
    openSettingsMock.mockResolvedValue();
    ((App as any).openSettings as vi.Mock).mockClear();
    ((App as any).openSettings as vi.Mock).mockResolvedValue(undefined);
    isNativePlatformMock.mockReturnValue(true);
    isPluginAvailableMock.mockReturnValue(true);
    registerPluginMock.mockClear();
  });

  it('opens with provided message and header', () =>
  {
    const alert = usePermissionAlert();
    alert.show({ header: 'Need permission', message: 'Grant location access.' });
    expect(alert.isOpen.value).toBe(true);
    expect(alert.header.value).toBe('Need permission');
    expect(alert.message.value).toBe('Grant location access.');
  });

  it('dismisses without calling App when cancelled', () =>
  {
    const alert = usePermissionAlert();
    alert.show({ message: 'Grant location access.' });
    alert.dismiss();
    expect(alert.isOpen.value).toBe(false);
    expect(openSettingsMock).not.toHaveBeenCalled();
  });

  it('invokes background geolocation openSettings when available', async () =>
  {
    const alert = usePermissionAlert();
    alert.show({ message: 'Grant location access.' });
    await alert.openSettings();
    expect(openSettingsMock).toHaveBeenCalledTimes(1);
    expect(((App as any).openSettings as vi.Mock)).not.toHaveBeenCalled();
    expect(alert.isOpen.value).toBe(false);
  });

  it('falls back to App.openSettings when background plugin unavailable', async () =>
  {
    isPluginAvailableMock.mockReturnValue(false);
    const alert = usePermissionAlert();
    alert.show({ message: 'Grant location access.' });
    await alert.openSettings();
    expect(openSettingsMock).not.toHaveBeenCalled();
    expect(((App as any).openSettings as vi.Mock)).toHaveBeenCalledTimes(1);
    expect(alert.isOpen.value).toBe(false);
  });

  it('logs a warning if no settings hooks are available', async () =>
  {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    isNativePlatformMock.mockReturnValue(false);
    (App as any).openSettings = undefined;

    const alert = usePermissionAlert();
    alert.show({ message: 'Grant location access.' });
    await alert.openSettings();

    expect(openSettingsMock).not.toHaveBeenCalled();
    expect(((App as any).openSettings)).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    expect(alert.isOpen.value).toBe(false);

    (App as any).openSettings = vi.fn(() => Promise.resolve());
    warnSpy.mockRestore();
  });
});
