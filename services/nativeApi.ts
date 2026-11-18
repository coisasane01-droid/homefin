import { Capacitor } from '@capacitor/core';

const HOMEFIN_ORIGIN = 'https://homefinapp.vercel.app';

export function homefinApiUrl(path: string): string {
  if (!path.startsWith('/api/')) {
    throw new Error('Caminho de API inválido.');
  }

  return Capacitor.isNativePlatform()
    ? `${HOMEFIN_ORIGIN}${path}`
    : path;
}
