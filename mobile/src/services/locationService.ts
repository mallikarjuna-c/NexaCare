import * as Location from 'expo-location';
import type { Coordinates } from '../types/emergency';

export type LocationResult =
  | { ok: true; coords: Coordinates; isApproximate: boolean }
  | { ok: false; reason: 'permission_denied' | 'services_off' | 'unavailable' };

const FRESH_FIX_TIMEOUT_MS = 10_000;

// Used by the readiness check, so permission can be granted calmly in advance — not mid-emergency.
export async function hasLocationPermission(): Promise<boolean> {
  return (await Location.getForegroundPermissionsAsync()).granted;
}

export async function requestLocationPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  const result = await Location.requestForegroundPermissionsAsync();
  if (result.granted) return 'granted';
  return result.canAskAgain ? 'denied' : 'blocked';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Asks for permission only at the moment it's needed, tries for a fresh GPS fix,
// and falls back to the last known position so an emergency share never hangs.
export async function getCurrentLocation(): Promise<LocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: 'permission_denied' };

  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'services_off' };

  try {
    const fresh = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      FRESH_FIX_TIMEOUT_MS
    );
    if (fresh) {
      const { latitude, longitude, accuracy } = fresh.coords;
      return { ok: true, coords: { latitude, longitude, accuracy }, isApproximate: false };
    }
  } catch {
    // fall through to last known position
  }

  const last = await Location.getLastKnownPositionAsync();
  if (last) {
    const { latitude, longitude, accuracy } = last.coords;
    return { ok: true, coords: { latitude, longitude, accuracy }, isApproximate: true };
  }
  return { ok: false, reason: 'unavailable' };
}
