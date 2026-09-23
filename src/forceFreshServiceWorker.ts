// Standalone iOS Home Screen apps have shown, across this entire debugging
// session, symptoms consistent with the Service Worker never actually
// delivering a fresh build: every code fix looked correct in isolation but
// the installed app kept showing old behavior no matter what changed, even
// surviving a full phone restart (which rules out a merely-suspended
// process — that clears everything in memory). The one thing a phone
// restart does NOT clear is disk-persisted state: the Service Worker
// registration and its Cache Storage. vite-plugin-pwa's injected
// autoUpdate script is supposed to handle this automatically, but that
// automatic reload has been unreliable specifically inside standalone
// WKWebView elsewhere in this app's history — so this does it explicitly
// and aggressively instead of trusting it silently in the background.
//
// On every load: ask the currently active service worker (if any) to
// unregister and wipe every Cache Storage entry, then hard-reload exactly
// once. Guarded by a sessionStorage flag so it can't loop.
// Bump this string to force everyone through the reset one more time in
// the future if needed; otherwise this block runs at most once per browser
// storage, ever — not on every launch — so it doesn't turn into a
// permanent reload-flash on every app open once this has actually run.
const RESET_GENERATION = 'sw-force-refresh-2026-09-23-1'

export async function forceFreshServiceWorkerOnce() {
  if (!('serviceWorker' in navigator)) return
  if (localStorage.getItem(RESET_GENERATION)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const hadRegistration = registrations.length > 0
    for (const registration of registrations) {
      await registration.unregister()
    }

    const cacheKeys = await (typeof caches !== 'undefined' ? caches.keys() : Promise.resolve<string[]>([]))
    const hadCaches = cacheKeys.length > 0
    await Promise.all(cacheKeys.map((key) => caches.delete(key)))

    localStorage.setItem(RESET_GENERATION, '1')
    if (hadRegistration || hadCaches) {
      window.location.reload()
    }
  } catch {
    // Best-effort — if this fails (e.g. caches unavailable), just let the
    // app boot normally rather than blocking startup on it.
  }
}
