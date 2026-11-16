/** Real camera for photo keepsakes (gallery + flip, like the med-fi). */
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, RustyAvatar, T, tap } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

export default function Camera() {
  const params = useLocalSearchParams<{ taskId?: string; hobbyId?: string }>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const cam = useRef<CameraView>(null);

  const next = (uri: string) =>
    router.replace({ pathname: '/keepsake/new', params: { uri, taskId: params.taskId ?? '', hobbyId: params.hobbyId ?? '' } });

  const shoot = async () => {
    if (!cam.current || !ready || busy) return;
    tap('medium');
    setBusy(true);
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) next(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  const library = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 5] });
    if (!res.canceled && res.assets[0]) next(res.assets[0].uri);
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.cameraBg }} />;

  if (!permission.granted) {
    return (
      <View style={[styles.ask, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
        <RustyAvatar pose="think" size={120} />
        <T v="title1" center>
          Can I borrow your camera?
        </T>
        <T v="callout" color={colors.inkSoft} center>
          Snap what you made, and it becomes a keepsake. Photos stay private to you.
        </T>
        {permission.canAskAgain ? <Button onPress={requestPermission}>Allow camera</Button> : <T v="caption" center>Turn on camera access for Restie in your phone’s Settings.</T>}
        <Button variant="secondary" icon="gallery" onPress={library}>
          Choose from photos instead
        </Button>
        <Button variant="tertiary" small onPress={() => router.back()}>
          Not now
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cameraBg }}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} onCameraReady={() => setReady(true)} />
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <IconButton name="close" label="Close camera" color={colors.white} bg="rgba(0,0,0,0.3)" onPress={() => router.back()} />
        <T v="headline" color={colors.white}>
          New keepsake
        </T>
        <View style={{ width: 44 }} />
      </View>
      <View style={[styles.controls, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.labeled}>
          <IconButton name="gallery" label="Choose from photos" color={colors.white} bg="rgba(255,255,255,0.18)" size={52} onPress={library} />
          <T v="caption" color={colors.white}>
            Photos
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={shoot} style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.92 }] }]}>
          <View style={[styles.shutterInner, busy && { backgroundColor: colors.accent }]} />
        </Pressable>
        <View style={styles.labeled}>
          <IconButton
            name="flip"
            label="Flip camera"
            color={colors.white}
            bg="rgba(255,255,255,0.18)"
            size={52}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          />
          <T v="caption" color={colors.white}>
            Flip
          </T>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { flex: 1, backgroundColor: colors.paper, padding: space.xl, gap: space.md, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: space.lg, backgroundColor: 'rgba(0,0,0,0.25)' },
  labeled: { alignItems: 'center', gap: space.xs },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.white },
});
