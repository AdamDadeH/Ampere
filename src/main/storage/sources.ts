import { v4 as uuidv4 } from 'uuid'
import { LibraryDatabase } from '../database'
import { detectProtonDrive, isProtonDrivePath } from './proton-drive'

export interface StorageSource {
  id: string
  type: 'local' | 'proton-drive'
  root_path: string
  label: string | null
  proton_email: string | null
  added_at?: string
}

/**
 * Determine the source type for a given path.
 */
export function getSourceTypeForPath(filePath: string): 'local' | 'proton-drive' {
  return isProtonDrivePath(filePath) ? 'proton-drive' : 'local'
}

/**
 * Auto-detect and register Proton Drive folders as storage sources.
 * Only registers folders that aren't already registered.
 * Returns any newly registered sources.
 */
export function autoRegisterProtonDriveSources(db: LibraryDatabase): StorageSource[] {
  const detected = detectProtonDrive()
  const existing = db.getStorageSources()
  const existingPaths = new Set(existing.map(s => s.root_path))

  const newSources: StorageSource[] = []

  for (const pd of detected) {
    if (!existingPaths.has(pd.path)) {
      const source: StorageSource = {
        id: uuidv4(),
        type: 'proton-drive',
        root_path: pd.path,
        label: `Proton Drive (${pd.email})`,
        proton_email: pd.email
      }
      db.addStorageSource(source)
      newSources.push(source)
    }
  }

  return newSources
}

/**
 * Find the storage source that owns a given file path.
 * Matches by longest root_path prefix.
 */
export function findSourceForPath(db: LibraryDatabase, filePath: string): StorageSource | undefined {
  const sources = db.getStorageSources() as StorageSource[]
  let best: StorageSource | undefined
  let bestLen = 0

  for (const source of sources) {
    if (filePath.startsWith(source.root_path) && source.root_path.length > bestLen) {
      best = source
      bestLen = source.root_path.length
    }
  }

  return best
}
