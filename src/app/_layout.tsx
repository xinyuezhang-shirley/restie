import { Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Toast } from '@/components/Toast';
import { useStore } from '@/data/store';
import { startSync } from '@/data/sync';
import { colors } from '@/theme/tokens';
import { TutorialOverlay } from '@/tutorial/tutorial';
import { useWorldClock } from '@/world/world';

SplashScreen.preventAutoHideAsync().catch(() => {});

const sheet = { presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } } as const;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const hydrated = useStore((s) => s.hydrated);
  const allowLocation = useStore((s) => s.profile.settings.location);
  const started = useRef(false);

  useWorldClock(allowLocation);

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    void startSync();
  }, [hydrated]);

  useEffect(() => {
    if (fontsLoaded && hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, hydrated]);

  // Tapping a check-in reminder opens the Hobbies check-in.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.page}>
          <View style={styles.phone}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="rusty" options={sheet} />
              <Stack.Screen name="log" options={sheet} />
              <Stack.Screen name="promise" options={sheet} />
              <Stack.Screen name="step/[id]" options={sheet} />
              <Stack.Screen name="report" options={sheet} />
              <Stack.Screen name="focus/done" options={{ ...sheet, gestureEnabled: false }} />
              <Stack.Screen name="keepsake/[id]" options={sheet} />
              <Stack.Screen name="pin" options={sheet} />
              <Stack.Screen name="camera" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="focus/timer" options={{ gestureEnabled: false }} />
            </Stack>
            <Toast />
            <TutorialOverlay />
          </View>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // On a laptop the web build shows as a phone-width column (like the med-fi).
  page: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#E8DFD0' : colors.paper },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 440 : undefined,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.paper,
  },
});
