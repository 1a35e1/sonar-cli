import { execSync } from 'child_process'
import { platform } from 'os'

export function openUrl(url: string): void {
  const cmd =
    platform() === 'darwin' ? 'open'
    : platform() === 'win32' ? 'start'
    : 'xdg-open'

  try {
    execSync(`${cmd} "${url}"`, { stdio: 'ignore' })
  } catch {}
}
