/** Little floating hearts, sparkles and z's around Rusty. */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fonts } from '@/theme/tokens';

export type ParticleType = 'heart' | 'spark' | 'z';

interface P {
  id: number;
  type: ParticleType;
  x: number;
  y: number;
  dx: number;
  life: number;
  scale: number;
}

export interface ParticlesHandle {
  spawn: (type: ParticleType, x: number, y: number) => void;
}

const GLYPH = { heart: '♥', spark: '✦', z: 'z' } as const;
const COLOR = { heart: '#EE6F86', spark: '#F2BE45', z: '#8C6A9E' } as const;

let nextId = 1;

export const Particles = forwardRef<ParticlesHandle, { size: number }>(function Particles({ size }, ref) {
  const [items, setItems] = useState<P[]>([]);

  const spawn = useCallback((type: ParticleType, x: number, y: number) => {
    const p: P = {
      id: nextId++,
      type,
      x,
      y,
      dx: (Math.random() - 0.5) * 28,
      life: type === 'z' ? 2600 : 1500,
      scale: 0.7 + Math.random() * 0.6,
    };
    setItems((xs) => [...xs.slice(-14), p]);
    setTimeout(() => setItems((xs) => xs.filter((i) => i.id !== p.id)), p.life + 50);
  }, []);

  useImperativeHandle(ref, () => ({ spawn }), [spawn]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: size, height: size }]}>
      {items.map((p) => (
        <Particle key={p.id} p={p} unit={size / 700} />
      ))}
    </View>
  );
});

function Particle({ p, unit }: { p: P; unit: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: p.life, easing: Easing.out(Easing.quad) });
  }, [t, p.life]);
  const style = useAnimatedStyle(() => {
    const a = t.value < 0.15 ? t.value / 0.15 : 1 - (t.value - 0.15) / 0.85;
    return {
      opacity: Math.max(0, a),
      transform: [
        { translateX: p.dx * t.value * unit * 2 + (p.type === 'z' ? Math.sin(t.value * 9) * 6 * unit : 0) },
        { translateY: -90 * t.value * unit * (p.type === 'z' ? 1.4 : 1) },
        { rotate: p.type === 'spark' ? `${t.value * 120}deg` : '0deg' },
        { scale: p.scale * (p.type === 'spark' ? 1 - Math.abs(0.5 - t.value) : 1) },
      ],
    };
  });
  const fontSize = (p.type === 'z' ? 34 : 30) * unit * 1.6;
  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          left: p.x * unit - fontSize / 2,
          top: p.y * unit - fontSize / 2,
          fontSize,
          lineHeight: fontSize * 1.1,
          color: COLOR[p.type],
          fontFamily: p.type === 'z' ? fonts.heading : undefined,
        },
        style,
      ]}
    >
      {GLYPH[p.type]}
    </Animated.Text>
  );
}
