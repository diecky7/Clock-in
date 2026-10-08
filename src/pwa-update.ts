/** Looks for a newer version of the app, waits for it to activate (up to 4 s), then reloads. */
export async function updateApp(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
    const next = reg?.installing ?? reg?.waiting
    if (next && next.state !== 'activated') {
      await new Promise<void>((resolve) => {
        next.addEventListener('statechange', () => next.state === 'activated' && resolve())
        setTimeout(resolve, 4000)
      })
    }
  } catch {
    // Offline or no service worker: a plain reload is still fine.
  }
  window.location.reload()
}
