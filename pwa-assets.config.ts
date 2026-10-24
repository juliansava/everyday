import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // The icon's content already sits inside the maskable safe zone, so render it full-bleed
    // on the app's dark background instead of the preset's white padding.
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
      resizeOptions: { background: '#111214' },
    },
  },
  images: ['public/icons/icon.svg'],
});
