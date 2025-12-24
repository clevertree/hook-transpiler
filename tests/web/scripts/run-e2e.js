// ESM script to start the local test server, wait for readiness,
// run Cypress tests, then shut the server down.
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const webDir = path.join(__dirname, '..')

const baseUrl = process.env.CYPRESS_baseUrl || 'http://localhost:8083'
const spec = process.env.SPEC

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function waitForServer(url, timeoutMs = 30000) {
    const start = Date.now()
    for (; ;) {
        try {
            const res = await fetch(url, { method: 'GET' })
            if (res.ok) return
        } catch (_) { }
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for server at ${url}`)
        }
        await wait(500)
    }
}

async function main() {
    console.log(`[e2e] Starting server in ${webDir}...`)
    const server = spawn('node', ['server.js'], {
        cwd: webDir,
        stdio: 'inherit',
        env: { ...process.env },
    })

    let shuttingDown = false
    const shutdown = () => {
        if (shuttingDown) return
        shuttingDown = true
        if (!server.killed) {
            try { server.kill('SIGINT') } catch { }
        }
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    process.on('exit', shutdown)

    try {
        console.log(`[e2e] Waiting for server at ${baseUrl}...`)
        await waitForServer(baseUrl)
        console.log(`[e2e] Server is up. Running Cypress...`)

        const cypressArgs = ['cypress', 'run']
        if (spec) cypressArgs.push('--spec', spec)

        // Ensure baseUrl is available to Cypress via env
        const cypressEnv = { ...process.env, CYPRESS_baseUrl: baseUrl }
        const cypress = spawn('npx', cypressArgs, {
            cwd: webDir,
            stdio: 'inherit',
            env: cypressEnv,
        })

        const code = await new Promise(resolve => {
            cypress.on('close', resolve)
        })

        if (code !== 0) {
            throw new Error(`Cypress exited with code ${code}`)
        }
    } finally {
        shutdown()
    }
}

main().catch(err => {
    console.error('[e2e] Error:', err.message)
    process.exit(1)
})
