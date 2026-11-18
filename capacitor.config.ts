import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.homefin.mobile',
  appName: 'HomeFin',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  },

 plugins: { CapacitorHttp: { enabled: true } },
};

export default config;
