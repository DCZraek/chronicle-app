// ═══════════════════════════════════════════════════════════
// CHRONICLE TRAY — System tray icon for The Chronicle server
// ═══════════════════════════════════════════════════════════

const SysTray  = require('systray2').default
const { spawn, exec } = require('child_process')
const path     = require('path')
const os       = require('os')

const PROJECT_DIR = __dirname
const KOKORO_PATH = path.join(os.homedir(), 'kokoro_server.py')
const SERVER_PATH = path.join(PROJECT_DIR, 'chronicle-server.js')

let kokoroProcess = null
let serverProcess = null
let isRunning     = false

// ── Small amber circle icon (32x32 base64 PNG) ────────────
const ICON = `iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAw0lEQVRYhe2WMQ6DMAxFHyIGdkbu0KFSuRCnoFKlniWnKAMrA2cg6tSBLSNSQkgc+xMJ8Zce/OzEfilBRERERERERERERERERERE9DWAHXgCb2AF7sAFuIEHcAdW4AlcwSNYgRXYgQdwBI7ADbyCI3ADD+AGPIEHeAEv4A28gA/wBm7AA3jnB3zjB3ziB3zjB3ziB3BjB3BiB3BiB3DiB3DiB3DiB2QnB2QnB2QnB2QnJHciJHciJHciJHciJHciAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAvPQHFHFDtPQAAAABJRU5ErkJggg==`

// ── Server control ─────────────────────────────────────────
function startServers() {
  if (isRunning) return
  console.log('[Tray] Starting Kokoro...')
  kokoroProcess = spawn('py', [KOKORO_PATH], {
    detached: false,
    stdio:    'ignore',
  })
  console.log('[Tray] Starting Chronicle server...')
  serverProcess = spawn('node', [SERVER_PATH], {
    cwd:      PROJECT_DIR,
    detached: false,
    stdio:    'ignore',
  })
  serverProcess.on('error', (e) => console.error('[Tray] Server error:', e.message))
  kokoroProcess.on('error', (e) => console.error('[Tray] Kokoro error:', e.message))
  isRunning = true
  console.log('[Tray] Servers started.')
}

function stopServers() {
  if (!isRunning) return
  if (serverProcess) { serverProcess.kill(); serverProcess = null }
  if (kokoroProcess) { kokoroProcess.kill(); kokoroProcess = null }
  isRunning = false
  console.log('[Tray] Servers stopped.')
}

function openBrowser() {
  exec('start http://localhost:3000')
}

// ── Menu items ─────────────────────────────────────────────
const itemToggle = {
  title:   '⏹  Stop Server',
  tooltip: 'Start or stop the Chronicle server',
  checked: false,
  enabled: true,
  click:   () => {
    if (isRunning) {
      stopServers()
      itemToggle.title = '▶  Start Server'
    } else {
      startServers()
      itemToggle.title = '⏹  Stop Server'
    }
    systray.sendAction({ type: 'update-item', item: itemToggle, seq_id: 0 })
  }
}

const itemBrowser = {
  title:   '🌐  Open Browser',
  tooltip: 'Open The Chronicle in your browser',
  checked: false,
  enabled: true,
  click:   () => { if (isRunning) openBrowser() }
}

const itemQuit = {
  title:   '✕  Quit',
  tooltip: 'Stop servers and exit',
  checked: false,
  enabled: true,
  click:   () => {
    stopServers()
    systray.kill(false)
  }
}

// ── Create tray ────────────────────────────────────────────
const systray = new SysTray({
  menu: {
    icon:    ICON,
    title:   '',
    tooltip: 'The Chronicle',
    items:   [itemToggle, itemBrowser, itemQuit],
  },
  debug:   false,
  copyDir: true,
})

systray.onClick((action) => {
  if (action.item && action.item.click) {
    action.item.click()
  }
})

// ── Boot ───────────────────────────────────────────────────
console.log('[Chronicle Tray] Starting...')
startServers()
console.log('[Chronicle Tray] Tray icon active. Right-click to control.')