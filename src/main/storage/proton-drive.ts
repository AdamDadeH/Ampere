import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'

const execFileAsync = promisify(execFile)

/**
 * Resolve path to the fp-evict Swift helper binary.
 * In dev: resources/bin/fp-evict relative to project root.
 * In production: bundled in app Resources.
 */
function getFpEvictPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', 'fp-evict')
  }
  // Development: relative to the compiled main process output
  return join(__dirname, '../../resources/bin/fp-evict')
}

const CLOUD_STORAGE_DIR = join(homedir(), 'Library', 'CloudStorage')
const PROTON_DRIVE_PREFIX = 'ProtonDrive-'

export interface ProtonDriveInfo {
  path: string
  email: string
}

/**
 * Scan ~/Library/CloudStorage/ for ProtonDrive-<email>/ directories.
 */
export function detectProtonDrive(): ProtonDriveInfo[] {
  try {
    const entries = readdirSync(CLOUD_STORAGE_DIR, { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory() && e.name.startsWith(PROTON_DRIVE_PREFIX))
      .map(e => {
        // Format: ProtonDrive-user@example.com-folder
        const rest = e.name.slice(PROTON_DRIVE_PREFIX.length)
        const email = rest.replace(/-folder$/, '')
        return { path: join(CLOUD_STORAGE_DIR, e.name), email }
      })
  } catch {
    return []
  }
}

/**
 * Check if a file path is within any Proton Drive folder.
 */
export function isProtonDrivePath(filePath: string): boolean {
  return filePath.startsWith(CLOUD_STORAGE_DIR + '/') &&
    filePath.slice(CLOUD_STORAGE_DIR.length + 1).startsWith(PROTON_DRIVE_PREFIX)
}

/**
 * Check if a specific file is materialized (downloaded to local disk).
 *
 * Uses macOS stat flags: SF_DATALESS (0x40000000) indicates a cloud-only
 * placeholder. If set, the file exists in the directory listing but has no
 * local data — reading it would trigger an automatic FileProvider download.
 *
 * Falls back to comparing allocated blocks vs file size as a secondary heuristic.
 */
export function isFileMaterialized(filePath: string): boolean {
  try {
    const s = statSync(filePath)
    // SF_DATALESS flag means the file is a cloud-only placeholder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: number = (s as any).flags ?? 0
    if (flags & 0x40000000) return false

    // Secondary heuristic: if allocated disk blocks are far smaller than file size,
    // the file is likely not materialized (sparse/placeholder)
    if (s.size > 0 && s.blocks * 512 < s.size * 0.1) return false

    return true
  } catch {
    // File doesn't exist at all
    return false
  }
}

/**
 * Request download of a cloud-only file.
 *
 * For Proton Drive's FileProvider, simply reading the file triggers download
 * automatically — macOS intercepts the read and fetches from cloud.
 * This function opens the file briefly to trigger that mechanism.
 */
export async function requestDownload(filePath: string): Promise<void> {
  const { open } = await import('fs/promises')
  try {
    // Opening the file for read triggers FileProvider auto-download
    const fh = await open(filePath, 'r')
    // Read a tiny chunk to ensure the download is initiated
    const buf = Buffer.alloc(1)
    await fh.read(buf, 0, 1, 0)
    await fh.close()
  } catch {
    // Download may be triggered even on error — FileProvider intercepts at vnode level
  }
}

/**
 * Evict a file from local cache (file stays in cloud listing, local data freed).
 * Uses the fp-evict Swift helper which calls FileManager.evictUbiquitousItem —
 * this works for Proton Drive and other third-party FileProvider extensions.
 */
export async function evictFile(filePath: string): Promise<void> {
  try {
    await execFileAsync(getFpEvictPath(), [filePath])
  } catch {
    // Eviction failed — file may already be evicted. Non-fatal.
  }
}

/**
 * Evict multiple files in a single helper invocation (batch mode).
 * More efficient than calling evictFile() in a loop.
 */
export async function evictFiles(filePaths: string[]): Promise<number> {
  if (filePaths.length === 0) return 0
  try {
    const { stdout } = await execFileAsync(getFpEvictPath(), filePaths)
    // Count "OK" lines in stdout
    return stdout.split('\n').filter(l => l.startsWith('OK ')).length
  } catch {
    return 0
  }
}

/**
 * Wait for a file to become materialized, polling with backoff.
 * Returns true if materialized within timeout, false otherwise.
 */
export async function waitForMaterialization(
  filePath: string,
  timeoutMs: number = 30_000
): Promise<boolean> {
  const start = Date.now()
  let interval = 200

  while (Date.now() - start < timeoutMs) {
    if (isFileMaterialized(filePath)) return true
    await new Promise(resolve => setTimeout(resolve, interval))
    interval = Math.min(interval * 1.5, 2000)
  }
  return false
}
