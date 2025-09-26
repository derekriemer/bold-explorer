import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  android: {
    useLegacyBridge: true,
  },
  appId: 'com.derekriemer.boldexplorer',
  appName: 'bold_explorer',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
      },
    },
  },
};

export default config;
