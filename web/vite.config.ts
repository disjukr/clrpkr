import { defineConfig } from "vite";
import vinext from "vinext";
import UnoCSS from "unocss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vinext(), normalizeVinextWindowsPaths(), UnoCSS()],
  server: {
    fs: {
      allow: [resolve(__dirname, "..")],
    },
  },
});

function normalizeVinextWindowsPaths() {
  const normalize = (source: string) =>
    source
      .replace(
        /(await import\(")([^"]+)("\))/g,
        (_match: string, prefix: string, specifier: string, suffix: string) => {
          return `${prefix}${specifier.replace(/\\/g, "/")}${suffix}`;
        },
      )
      .replace(
        /("__pageModule"\s*:\s*")([^"]+)(")/g,
        (_match: string, prefix: string, specifier: string, suffix: string) => {
          return `${prefix}${specifier.replace(/\\/g, "/")}${suffix}`;
        },
      )
      .replace(
        /("__appModule"\s*:\s*")([^"]+)(")/g,
        (_match: string, prefix: string, specifier: string, suffix: string) => {
          return `${prefix}${specifier.replace(/\\/g, "/")}${suffix}`;
        },
      );

  return {
    name: "normalize-vinext-windows-paths",
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return normalize(html);
    },
    transform(code: string, id: string) {
      if (!id.includes("?html-proxy")) {
        return null;
      }
      return {
        code: normalize(code),
        map: null,
      };
    },
  };
}
