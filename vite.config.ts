import { defineConfig } from 'vite';

// Suhteellinen base, jotta build toimii myös suoraan tiedostojärjestelmästä
// tai alihakemistosta tarjoiltuna (messukoneen kioskiselain).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    // Kaikki kuvat ja data pakataan koodiin, jotta tools/build-single.mjs
    // voi koota pelistä yhden itsenäisen HTML-tiedoston.
    assetsInlineLimit: 100_000_000,
  },
  server: {
    host: true,
    port: 5173,
    // Avaa pelin selaimeen automaattisesti, kun `npm run dev` käynnistyy.
    open: true,
  },
});
