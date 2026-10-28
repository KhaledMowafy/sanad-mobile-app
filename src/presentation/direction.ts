import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { DevSettings, I18nManager } from 'react-native';
import { isRtl, type Locale } from '@/i18n';

/** Reloads the app so a change of text direction takes effect. */
export async function reloadApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // Not available in development builds: the dev menu's reload does the same.
    DevSettings.reload();
  }
}

const ATTEMPT_KEY = 'sanad.rtlReload';

/**
 * Makes the layout direction match the language. React Native fixes direction when the app starts,
 * so a change needs a reload. Returns true when one was started and nothing should render yet.
 * A reload is tried once per direction: where the setting does not survive it (Expo Go), the app
 * carries on in the direction it has instead of reloading forever.
 */
export async function applyDirection(locale: Locale): Promise<boolean> {
  const rtl = isRtl(locale);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL === rtl) {
    await AsyncStorage.removeItem(ATTEMPT_KEY).catch(() => undefined);
    return false;
  }
  const tried = await AsyncStorage.getItem(ATTEMPT_KEY).catch(() => null);
  if (tried === String(rtl)) return false;
  await AsyncStorage.setItem(ATTEMPT_KEY, String(rtl)).catch(() => undefined);
  I18nManager.forceRTL(rtl);
  await reloadApp();
  return true;
}
