export interface FileEntry {
  path: string
  name: string
  size: number
  modifiedAt: Date
}

export interface StorageProvider {
  name: string
  scan(rootPath: string): AsyncGenerator<FileEntry>
  isAvailable(filePath: string): Promise<boolean>
  getLocalPath(filePath: string): string | null
}
