import { execFile, spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = join(here, '..')
const outputDir = join(webRoot, 'demo-artifacts')
const framesDir = join(outputDir, 'frames')
const videoPath = join(outputDir, 'proofsentry-demo.mp4')
const baseUrl = 'http://127.0.0.1:5173'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    await sleep(500)
  }
  throw new Error(`timed out waiting for ${url}`)
}

await mkdir(outputDir, { recursive: true })
await rm(framesDir, { recursive: true, force: true })
await mkdir(framesDir, { recursive: true })
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const vite = spawn(npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1'], {
  cwd: webRoot,
  stdio: 'ignore',
})

let browser
try {
  await waitForServer(baseUrl)
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()
  const startedAt = Date.now()

  await page.route('http://localhost:4000/api/feed**', async (route) => {
    const elapsed = Date.now() - startedAt
    const bids = elapsed < 3_000
      ? []
      : elapsed < 6_000
        ? [{ by: 'seller-fast', priceSol: 0.00018, note: 'fast availability proof' }]
        : [
            { by: 'seller-fast', priceSol: 0.00018, note: 'fast availability proof' },
            { by: 'seller-guardian', priceSol: 0.00032, note: 'balanced evidence' },
            { by: 'seller-forensic', priceSol: 0.00055, note: 'deep security checks' },
          ]
    const award = elapsed >= 9_000
      ? { to: 'seller-guardian', reason: 'best balance of evidence depth and price' }
      : undefined
    const delivered = elapsed >= 14_000
      ? {
          raw: 'ProofSentry evidence delivered',
          data: {
            service: 'proofsentry',
            version: '1.0',
            depth: 'standard',
            observedAt: new Date().toISOString(),
            latencyMs: 184,
            verdict: 'pass',
            summary: '4/4 checks passed',
            evidenceDigest: 'sha256:1b369d96c2af7a32761748470e0d3b62b8ac456ee46f1d9cc7397c5015cca2c6',
            evidence: {
              target: 'https://api.github.com/',
              observedStatus: 200,
              checks: [
                { name: 'status', pass: true, detail: 'received 200; expected 200' },
                { name: 'https', pass: true, detail: 'request and redirects stayed on HTTPS' },
                { name: 'content-type', pass: true, detail: 'application/json; charset=utf-8' },
                { name: 'latency', pass: true, detail: '184ms within 8000ms budget' },
              ],
            },
          },
        }
      : undefined

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        session: 'proofsentry-demo',
        updatedAt: new Date().toISOString(),
        rounds: [{
          round: 1,
          want: { service: 'proofsentry', arg: 'https://api.github.com 200', budgetSol: 0.001 },
          bids,
          declined: [],
          award,
          delivered,
          status: delivered ? 'delivered' : award ? 'awarded' : 'bidding',
        }],
      }),
    })
  })

  await page.goto(`${baseUrl}/?session=proofsentry-demo`)
  await page.evaluate(() => {
    const notice = document.createElement('div')
    notice.textContent = 'Deterministic product walkthrough — no funds move in this recording'
    Object.assign(notice.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '1000',
      padding: '10px 14px',
      border: '1px solid #d29922',
      borderRadius: '8px',
      background: '#141a24',
      color: '#d29922',
      font: '12px ui-monospace, monospace',
    })
    document.body.appendChild(notice)
  })
  for (let frame = 0; frame < 88; frame++) {
    await page.screenshot({ path: join(framesDir, `frame-${String(frame).padStart(4, '0')}.png`) })
    await sleep(250)
  }

  await context.close()
  await new Promise((resolve, reject) => {
    execFile(ffmpegInstaller.path, [
      '-y',
      '-framerate', '4',
      '-i', join(framesDir, 'frame-%04d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      videoPath,
    ], (error) => error ? reject(error) : resolve())
  })
  await rm(framesDir, { recursive: true, force: true })
  console.log(`Demo video written to ${videoPath}`)
} finally {
  if (browser) await browser.close()
  vite.kill()
}
