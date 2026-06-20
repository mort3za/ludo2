<script setup lang="ts">
import { computed } from "vue";
import { resolvedTheme } from "@/shared/lib/use-theme";

/**
 * Full-screen responsive background.
 * - Theme (sunset = light, night = dark) follows the app's theme switcher via
 *   the reactive `resolvedTheme` — NOT `prefers-color-scheme` (which would
 *   ignore a manual light/dark choice).
 * - Within the active theme, the browser picks orientation (portrait/landscape
 *   via `media`), format (AVIF > WebP > JPEG via `type`) and resolution
 *   (`srcset` width descriptors).
 */

type UrlMap = Record<string, string>;

const sunsetLandscape = import.meta.glob("@/assets/bg/sunset-landscape/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as UrlMap;
const sunsetMobile = import.meta.glob("@/assets/bg/sunset-mobile/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as UrlMap;
const nightLandscape = import.meta.glob("@/assets/bg/night-landscape/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as UrlMap;
const nightMobile = import.meta.glob("@/assets/bg/night-mobile/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as UrlMap;

const landscape = computed(() =>
  resolvedTheme.value === "dark" ? nightLandscape : sunsetLandscape,
);
const mobile = computed(() => (resolvedTheme.value === "dark" ? nightMobile : sunsetMobile));

/** Build a width-descriptor srcset for one image format, sorted ascending. */
function srcset(map: UrlMap, ext: string): string {
  return Object.entries(map)
    .filter(([path]) => path.endsWith(`.${ext}`))
    .map(([path, url]) => ({ url, width: Number(path.match(/_(\d+)x\d+/)?.[1] ?? 0) }))
    .sort((a, b) => a.width - b.width)
    .map(({ url, width }) => `${url} ${width}w`)
    .join(", ");
}

/** A mid-resolution JPEG used as the universal <img> fallback. */
function fallback(map: UrlMap): string {
  const jpgs = Object.entries(map)
    .filter(([path]) => path.endsWith(".jpg"))
    .map(([path, url]) => ({ url, width: Number(path.match(/_(\d+)x\d+/)?.[1] ?? 0) }))
    .sort((a, b) => a.width - b.width);
  return jpgs[Math.floor(jpgs.length / 2)]?.url ?? "";
}
</script>

<template>
  <!-- `:key` forces a fresh <picture> on theme change so the browser
       re-evaluates <source> selection instead of reusing the old image. -->
  <div class="app-bg" aria-hidden="true">
    <picture :key="resolvedTheme">
      <source
        media="(orientation: portrait)"
        type="image/avif"
        :srcset="srcset(mobile, 'avif')"
        sizes="100vw"
      />
      <source
        media="(orientation: portrait)"
        type="image/webp"
        :srcset="srcset(mobile, 'webp')"
        sizes="100vw"
      />
      <source
        media="(orientation: portrait)"
        type="image/jpeg"
        :srcset="srcset(mobile, 'jpg')"
        sizes="100vw"
      />
      <source type="image/avif" :srcset="srcset(landscape, 'avif')" sizes="100vw" />
      <source type="image/webp" :srcset="srcset(landscape, 'webp')" sizes="100vw" />
      <source type="image/jpeg" :srcset="srcset(landscape, 'jpg')" sizes="100vw" />
      <img :src="fallback(landscape)" alt="" />
    </picture>
  </div>
</template>

<style scoped>
.app-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.app-bg picture,
.app-bg img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
