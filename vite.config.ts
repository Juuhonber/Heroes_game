import { defineConfig } from 'vite';

// Suhteellinen base, jotta build toimii myös suoraan tiedostojärjestelmästä
// tai alihakemistosta tarjoiltuna (messukoneen kioskiselain).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
    port: 5173,
  },
});
