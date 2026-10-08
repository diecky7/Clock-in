import { APP_VERSION } from '../version'

export default function VersionFooter() {
  return (
    <footer className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-muted">
      <p aria-label={`App version ${APP_VERSION}`}>Clock-in v{APP_VERSION}</p>
    </footer>
  )
}
