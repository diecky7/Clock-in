import { APP_VERSION } from '../version'

export default function VersionFooter() {
  return (
    <footer className="mt-12 pb-4 text-center text-xs text-muted">
      <p aria-label={`App version ${APP_VERSION}`}>Clock-in v{APP_VERSION}</p>
    </footer>
  )
}
