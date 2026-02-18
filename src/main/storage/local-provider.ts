import { readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'
import { StorageProvider, FileEntry } from './provider'

export class LocalStorageProvider implements StorageProvider {
  name = 'local'
  private extensions: Set<string>

  constructor(extensions: Set<string>) {
    this.extensions = extensions
  }

  async *scan(rootPath: string): AsyncGenerator<FileEntry> {
    yield* this.walkDirectory(rootPath)
  }

  private async *walkDirectory(dir: string): AsyncGenerator<FileEntry> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.name.startsWith('.')) continue

      if (entry.isDirectory()) {
        yield* this.walkDirectory(fullPath)
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (this.extensions.has(ext)) {
          try {
            const fileStat = await stat(fullPath)
            yield {
              path: fullPath,
              name: entry.name,
              size: fileStat.size,
              modifiedAt: fileStat.mtime
            }
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  }

  async isAvailable(filePath: string): Promise<boolean> {
    return existsSync(filePath)
  }

  getLocalPath(filePath: string): string | null {
    return existsSync(filePath) ? filePath : null
  }
}
