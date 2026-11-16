/**
 * Local reminders at the time a person promised a tiny step.
 * Rules from the med-fi values ("progress without guilt"): at most one
 * reminder per promise, never between 10pm and 8am, gentle wording.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Task } from '@/data/types';

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function askNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rusty', {
      name: 'Rusty check-ins',
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Move a time out of quiet hours (10pm–8am) to the next friendly hour. */
function friendly(d: Date): Date {
  const x = new Date(d);
  if (x.getHours() >= 22) {
    x.setDate(x.getDate() + 1);
    x.setHours(9, 0, 0, 0);
  } else if (x.getHours() < 8) x.setHours(9, 0, 0, 0);
  return x;
}

export async function scheduleCheckin(task: Task, enabled: boolean) {
  if (!supported) return;
  await cancelCheckin(task.id);
  if (!enabled || !task.dueAt || task.status !== 'open') return;
  const when = friendly(new Date(task.dueAt));
  if (when.getTime() < Date.now() + 60_000) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: task.id,
      content: {
        title: 'Rusty 🐾',
        body: `Still up for "${task.title}"? No pressure — even 5 minutes counts.`,
        data: { url: '/hobbies', taskId: task.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'rusty' },
    });
  } catch (e) {
    console.warn('[restie] could not schedule reminder', e);
  }
}

export async function cancelCheckin(taskId: string) {
  if (!supported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(taskId);
  } catch {
    // nothing scheduled
  }
}

/** One-off notification at a time (focus timer end). Re-scheduling replaces it. */
export async function scheduleAt(id: string, date: Date, title: string, body: string, url?: string) {
  if (!supported) return;
  await cancelCheckin(id);
  if (date.getTime() < Date.now() + 1000) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, data: url ? { url } : {} },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'rusty' },
    });
  } catch {
    // permission off — the in-app timer still works
  }
}

export const cancelScheduled = cancelCheckin;
