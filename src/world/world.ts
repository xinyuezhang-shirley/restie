/**
 * The world outside Rusty's window: sun phase + weather where you are.
 * Location stays on the device except for one request to Open-Meteo (no
 * account, no key). Without permission we use Stanford.
 */
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export type Phase = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
export type Condition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface World {
  phase: Phase;
  condition: Condition;
  tempF: number | null;
  place: string;
  sunrise: Date | null;
  sunset: Date | null;
  fetchedAt: number;
  /** Settings → "Preview the room" overrides, for demos */
  override: { phase?: Phase; condition?: Condition } | null;
}

const STANFORD = { latitude: 37.4275, longitude: -122.1697 };

export const useWorld = create<World>(() => ({
  phase: phaseFor(new Date(), null, null),
  condition: 'clear',
  tempF: null,
  place: 'Stanford',
  sunrise: null,
  sunset: null,
  fetchedAt: 0,
  override: null,
}));

/** What the room should look like right now (respects demo overrides). */
export function useSky() {
  return useWorld(
    useShallow((w) => ({
      phase: w.override?.phase ?? w.phase,
      condition: w.override?.condition ?? w.condition,
      tempF: w.tempF,
      place: w.place,
    })),
  );
}

export function phaseFor(d: Date, sunrise: Date | null, sunset: Date | null): Phase {
  const rise = sunrise ?? at(d, 6, 45);
  const set = sunset ?? at(d, 17, 15);
  const t = d.getTime();
  const m = 60_000;
  if (t < rise.getTime() - 45 * m || t > set.getTime() + 45 * m) return 'night';
  if (t < rise.getTime() + 45 * m) return 'dawn';
  if (t > set.getTime() - 15 * m) return 'dusk';
  if (t > set.getTime() - 80 * m) return 'golden';
  return 'day';
}

function at(d: Date, h: number, min: number) {
  const x = new Date(d);
  x.setHours(h, min, 0, 0);
  return x;
}

/** WMO weather codes → our six moods. */
function conditionFor(code: number): Condition {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloudy';
}

async function locate(allow: boolean) {
  if (!allow) return { coords: STANFORD, place: 'Stanford' };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { coords: STANFORD, place: 'Stanford' };
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 6 * 3600_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    let place = 'Nearby';
    if (Platform.OS !== 'web') {
      try {
        const [geo] = await Location.reverseGeocodeAsync(pos.coords);
        place = geo?.city ?? geo?.district ?? geo?.region ?? place;
      } catch {
        // reverse geocoding is optional
      }
    }
    return { coords: pos.coords, place };
  } catch {
    return { coords: STANFORD, place: 'Stanford' };
  }
}

export async function refreshWorld(allowLocation: boolean) {
  const { coords, place } = await locate(allowLocation);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude.toFixed(3)}` +
      `&longitude=${coords.longitude.toFixed(3)}&current=temperature_2m,weather_code` +
      `&daily=sunrise,sunset&forecast_days=1&timezone=auto&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    const j = await res.json();
    const sunrise = j.daily?.sunrise?.[0] ? new Date(j.daily.sunrise[0]) : null;
    const sunset = j.daily?.sunset?.[0] ? new Date(j.daily.sunset[0]) : null;
    useWorld.setState({
      condition: conditionFor(Number(j.current?.weather_code ?? 0)),
      tempF: Math.round(Number(j.current?.temperature_2m)),
      place,
      sunrise,
      sunset,
      phase: phaseFor(new Date(), sunrise, sunset),
      fetchedAt: Date.now(),
    });
  } catch {
    useWorld.setState({ place, phase: phaseFor(new Date(), null, null), fetchedAt: Date.now() });
  }
}

/** Keeps the world fresh: weather every 30 min, sun phase every minute. */
export function useWorldClock(allowLocation: boolean) {
  useEffect(() => {
    void refreshWorld(allowLocation);
    const weather = setInterval(() => void refreshWorld(allowLocation), 30 * 60_000);
    const sun = setInterval(() => {
      const w = useWorld.getState();
      useWorld.setState({ phase: phaseFor(new Date(), w.sunrise, w.sunset) });
    }, 60_000);
    return () => {
      clearInterval(weather);
      clearInterval(sun);
    };
  }, [allowLocation]);
}

export const weatherEmoji = (c: Condition, phase: Phase) =>
  ({ clear: phase === 'night' ? '🌙' : '☀️', cloudy: '☁️', fog: '🌫️', rain: '🌧️', snow: '❄️', storm: '⛈️' })[c];
