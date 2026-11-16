// Web entry: Skia (Rusty's animated puppet) needs CanvasKit loaded before any
// Skia module runs, so we load it first and then start Expo Router.
import '@expo/metro-runtime';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// react-native-skia 2.14 (web) tags its WebGL canvases as display-p3 but draws
// into them with an sRGB surface, so the browser shows everything Skia draws
// (the live puppet) ~18% more saturated than the same image elsewhere — Rusty's
// orange jumped every time a move handed off to the puppet. Keep WebGL canvases
// in sRGB. (Skia is the only WebGL user in the app.)
for (const GL of [globalThis.WebGL2RenderingContext, globalThis.WebGLRenderingContext]) {
  const d = GL && Object.getOwnPropertyDescriptor(GL.prototype, 'drawingBufferColorSpace');
  if (d && d.set) {
    Object.defineProperty(GL.prototype, 'drawingBufferColorSpace', {
      ...d,
      set() {
        d.set.call(this, 'srgb');
      },
    });
  }
}

const base = process.env.EXPO_BASE_URL ?? '';

LoadSkiaWeb({ locateFile: (file) => `${base}/${file}` })
  .catch((e) => {
    // Rusty falls back to a still image; the rest of the app is unaffected.
    console.warn('[restie] CanvasKit failed to load', e);
  })
  .finally(() => {
    const { App } = require('expo-router/build/qualified-entry');
    const { renderRootComponent } = require('expo-router/build/renderRootComponent');
    renderRootComponent(App);
  });
