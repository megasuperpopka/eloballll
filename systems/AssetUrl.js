/**
 * Абсолютный URL к файлу из папки `assets/` рядом с корнем игры.
 * Нужен для Capacitor и для `www/`, чтобы пути не зависели только от адреса index.html.
 */
export function resolveGameAssetUrl(relativePath) {
  if (typeof relativePath !== "string") return relativePath;
  const t = relativePath.trim().replace(/^\.\//, "");
  if (!t) return relativePath;
  if (/^https?:\/\//i.test(t) || t.startsWith("data:") || t.startsWith("blob:")) return t;
  try {
    // На GitHub Pages база — папка index.html, а не systems/*.js
    if (typeof window !== "undefined" && window.location?.href) {
      return new URL(t, window.location.href).href;
    }
    return new URL(`../${t}`, import.meta.url).href;
  } catch {
    return relativePath;
  }
}
