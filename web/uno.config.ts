import { defineConfig, presetIcons, presetWind4 } from "unocss";

export default defineConfig({
  presets: [presetWind4(), presetIcons()],
  shortcuts: {
    "glass-panel":
      "rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur",
  },
  theme: {
    colors: {
      accent: {
        DEFAULT: "#f97316",
        soft: "#fb923c",
      },
    },
  },
});
