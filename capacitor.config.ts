import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  android: {
    useLegacyBridge: true,
  },
  appId: 'com.derekriemer.boldexplorer',
  appName: 'bold_explorer',
  webDir: 'dist'
};

export default config;
