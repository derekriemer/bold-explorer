import { Preferences } from '@capacitor/preferences';

export const getUnits = async (): Promise<'metric' | 'imperial'> => {
  const { value } = await Preferences.get({ key: 'units' });
  return (value as any) ?? 'metric';
};

export const setUnits = (value: 'metric' | 'imperial') => Preferences.set({ key: 'units', value });

export const getCompassMode = async (): Promise<'magnetic' | 'true'> => {
  const { value } = await Preferences.get({ key: 'compass_mode' });
  return (value as any) ?? 'magnetic';
};

export const setCompassMode = (value: 'magnetic' | 'true') => Preferences.set({ key: 'compass_mode', value });

export const getAudioCuesEnabled = async (): Promise<boolean> => {
  const { value } = await Preferences.get({ key: 'audio_cues' });
  return value === 'true';
};

export const setAudioCuesEnabled = (value: boolean) => Preferences.set({ key: 'audio_cues', value: String(value) });
