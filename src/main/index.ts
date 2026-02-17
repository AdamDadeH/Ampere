import { app, BrowserWindow, ipcMain, dialog, protocol, net, session } from 'electron'
import { join, extname } from 'path'
import { pathToFileURL } from 'url'
import { createReadStream, readFileSync, statSync } from 'fs'
import { createServer, Server } from 'http'
import { LibraryDatabase } from './database'
import { LocalStorageProvider } from './storage/local-provider'
import { FolderScanner } from './scanner'

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

let db: LibraryDatabase
let scanner: FolderScanner
let mainWindow: BrowserWindow | null = null
let compactWindow: BrowserWindow | null = null
let audioServer: Server | null = null
let audioServerPort = 0

function startAudioServer(): Promise<number> {
  return new Promise((resolve) => {
    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type'
    }

    audioServer = createServer((req, res) => {
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS)
        res.end()
        return
      }

      const filePath = decodeURIComponent(req.url?.slice(1) || '')
      if (!filePath) {
        res.writeHead(400, CORS_HEADERS)
        res.end('Missing file path')
        return
      }

      const ext = extname(filePath).toLowerCase()
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

      let stat
      try {
        stat = statSync(filePath)
      } catch {
        res.writeHead(404, CORS_HEADERS)
        res.end('File not found')
        return
      }

      const range = req.headers.range
      if (range) {
        // Handle range requests for seeking
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
        const chunkSize = end - start + 1

        res.writeHead(206, {
          ...CORS_HEADERS,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType
        })
        createReadStream(filePath, { start, end }).pipe(res)
      } else {
        res.writeHead(200, {
          ...CORS_HEADERS,
          'Content-Length': stat.size,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes'
        })
        createReadStream(filePath).pipe(res)
      }
    })

    audioServer.listen(0, '127.0.0.1', () => {
      const addr = audioServer!.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      console.log(`Audio server listening on port ${port}`)
      resolve(port)
    })
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createCompactWindow(): void {
  if (compactWindow && !compactWindow.isDestroyed()) return

  // Center compact window on mainWindow's position
  let x: number | undefined
  let y: number | undefined
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [wx, wy] = mainWindow.getPosition()
    const [ww, wh] = mainWindow.getSize()
    x = Math.round(wx + (ww - 400) / 2)
    y = Math.round(wy + (wh - 150) / 2)
  }

  compactWindow = new BrowserWindow({
    width: 400,
    height: 150,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    minimizable: true,
    maximizable: false,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    compactWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?mode=compact')
  } else {
    compactWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode: 'compact' }
    })
  }

  compactWindow.on('closed', () => {
    compactWindow = null
    // Show library window when compact is closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })
}

function setupIPC(): void {
  ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Music Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const folderPath = result.filePaths[0]

    // Start scanning in background
    scanner.scan(folderPath, mainWindow).catch(err => {
      console.error('Scan failed:', err)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan-progress', {
          phase: 'error',
          current: 0,
          total: 0,
          error: err.message
        })
      }
    })

    return folderPath
  })

  ipcMain.handle('get-tracks', (_event, filter?: { artist?: string; album?: string }) => {
    if (filter?.artist && filter?.album) {
      return db.getTracksByAlbum(filter.album, filter.artist)
    }
    if (filter?.artist) {
      return db.getTracksByArtist(filter.artist)
    }
    if (filter?.album) {
      return db.getTracksByAlbum(filter.album)
    }
    return db.getAllTracks()
  })

  ipcMain.handle('get-artists', () => db.getArtists())

  ipcMain.handle('get-album-artists', () => db.getAlbumArtists())

  ipcMain.handle('get-tracks-by-album-artist', (_event, artist: string) => db.getTracksByAlbumArtist(artist))

  ipcMain.handle('get-albums-by-album-artist', (_event, artist: string) => db.getAlbumsByAlbumArtist(artist))

  ipcMain.handle('get-albums', (_event, artist?: string) => db.getAlbums(artist))

  ipcMain.handle('get-track-path', (_event, trackId: string) => {
    const track = db.getTrack(trackId)
    if (!track) return null
    // Return URL to local audio server
    return `http://127.0.0.1:${audioServerPort}/${encodeURIComponent(track.file_path)}`
  })

  ipcMain.handle('update-play-count', (_event, trackId: string) => {
    db.incrementPlayCount(trackId)
  })

  ipcMain.handle('get-library-stats', () => db.getLibraryStats())

  ipcMain.handle('search-tracks', (_event, query: string) => db.searchTracks(query))

  ipcMain.handle('set-rating', (_event, trackId: string, rating: number) => {
    db.setRating(trackId, rating)
  })

  ipcMain.handle('select-wsz-skin', async () => {
    const win = compactWindow || mainWindow
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Winamp Skins', extensions: ['wsz', 'zip'] }],
      title: 'Load Winamp Skin'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const data = readFileSync(result.filePaths[0])
    return data.buffer
  })

  ipcMain.handle('set-compact-size', (_event, width: number, height: number) => {
    if (compactWindow && !compactWindow.isDestroyed()) {
      const [cx, cy] = compactWindow.getPosition()
      const [cw] = compactWindow.getSize()
      compactWindow.setSize(width, height)
      compactWindow.setPosition(Math.round(cx + (cw - width) / 2), cy)
    }
  })

  // Compact mode IPC
  ipcMain.handle('set-window-mode', (_event, mode: 'library' | 'compact') => {
    if (mode === 'compact') {
      createCompactWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide()
      }
    } else {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
      }
      if (compactWindow && !compactWindow.isDestroyed()) {
        compactWindow.close()
      }
    }
  })

  ipcMain.handle('get-window-mode', (event) => {
    if (compactWindow && !compactWindow.isDestroyed() &&
        event.sender === compactWindow.webContents) {
      return 'compact'
    }
    return 'library'
  })

  ipcMain.handle('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.handle('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.on('remote-player-command', (_event, command: string, ...args: unknown[]) => {
    // Forward from compact window to library window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('player-command', command, ...args)
    }
  })

  ipcMain.on('player-state-update', (_event, state: unknown) => {
    // Forward from library window to compact window
    if (compactWindow && !compactWindow.isDestroyed()) {
      compactWindow.webContents.send('player-state-update', state)
    }
  })
}

app.whenReady().then(async () => {
  // Register custom protocol for serving local files (artwork)
  protocol.handle('atom', (request) => {
    let filePath = decodeURIComponent(request.url.replace(/^atom:\/\//, ''))
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // Start local audio server for streaming with range request support
  audioServerPort = await startAudioServer()

  db = new LibraryDatabase()
  const provider = new LocalStorageProvider()
  scanner = new FolderScanner(db, provider)

  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit when library is just hidden (compact mode active)
  if (process.platform !== 'darwin') {
    const hasVisible = BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isVisible())
    if (!hasVisible && !(mainWindow && !mainWindow.isDestroyed())) {
      app.quit()
    }
  }
})

app.on('before-quit', () => {
  db?.close()
  audioServer?.close()
})
