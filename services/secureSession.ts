import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

const PREFIX = 'homefin_secure_';

let initialization: Promise<void> | null = null;

async function initializeStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  if (!initialization) {
    initialization = SecureStorage.setKeyPrefix(PREFIX)
      .catch((error) => {
        initialization = null;
        throw error;
      });
  }

  await initialization;
}

export async function secureSessionGet(key: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    return localStorage.getItem(key);
  }

  await initializeStorage();

  const value = await SecureStorage.get(key);

  return typeof value === 'string' ? value : null;
}

export async function secureSessionSet(
  key: string,
  value: string
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    localStorage.setItem(key, value);
    return;
  }

  await initializeStorage();
  await SecureStorage.set(key, value);
}

export async function secureSessionRemove(key: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    localStorage.removeItem(key);
    return;
  }

  await initializeStorage();
  await SecureStorage.remove(key);
}

export async function checkNativeBiometry() {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  return BiometricAuth.checkBiometry();
}

export async function authenticateNativeBiometry(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Biometria nativa indisponível no navegador.');
  }

  const result = await BiometricAuth.checkBiometry();

  if (!result.isAvailable) {
    throw new Error('Configure a biometria do aparelho para continuar.');
  }

  await BiometricAuth.authenticate({
    reason: 'Confirme sua identidade para acessar o HomeFin.',
    allowDeviceCredential: false,
    androidTitle: 'Acessar HomeFin',
    iosFallbackTitle: '',
  });
}

export function isNativeHomeFin(): boolean {
  return Capacitor.isNativePlatform();
}
