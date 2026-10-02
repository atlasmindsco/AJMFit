/*
 * Service worker for AJM Fit.
 *
 * DELIBERATELY DOES NOT CACHE ANYTHING.
 *
 * It exists for one reason: Chrome on Android will only show a notification
 * through a service worker registration, and the rest timer needs to reach a
 * client whose screen has gone dark mid-rest. There is no fetch handler here,
 * so every request goes to the network exactly as it would without a service
 * worker, and a deploy can never leave anyone stranded on stale JavaScript.
 *
 * Offline caching is a separate piece of work with its own failure modes. The
 * set queue in lib/set-queue.ts already covers the realistic gym problem — a
 * write that times out while the tab is open — without any of this.
 */

const VERSION = 'ajmfit-notify-1'

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every tab to close. Safe
  // precisely because nothing is cached: there is no old content to serve.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clear anything a previous version of this file may have cached, so
      // that if caching is ever added and then reverted, nobody is stuck.
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n.startsWith('ajmfit-')).map((n) => caches.delete(n)))
      await self.clients.claim()
    })()
  )
})

// Tapping the rest notification should put the client back in their workout,
// reusing the tab they already have open rather than opening a second one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if (client.url.includes('/studio') && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/studio/programs')
    })()
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'version') event.source?.postMessage(VERSION)
})
