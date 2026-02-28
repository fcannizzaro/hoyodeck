import { startCrawler } from './crawler'

let initialized = false

/** Call once on server startup to initialize background services. */
export function initServices(): void {
  if (initialized) return
  initialized = true
  startCrawler()
}
