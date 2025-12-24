import { test } from 'node:test'
import assert from 'node:assert'

/**
 * Unit tests for HookLoader module cache and deduplication
 * Note: These tests mock fetch and import the compiled dist files
 */

test('HookLoader should deduplicate concurrent calls to loadModule for the same path', async () => {
    const fetchCalls: string[] = []
    const mockFetch = async (url: string) => {
        fetchCalls.push(url)
        return {
            ok: true,
            headers: { get: () => 'application/javascript' },
            text: async () => 'export default function Test() { return "test" }'
        }
    }
    globalThis.fetch = mockFetch as any

    const { HookLoader, WebModuleLoader } = await import('../../dist/web/runtimeLoader.js')

    const mockContext = {
        React: { createElement: () => ({}) },
        createElement: () => ({}),
        FileRenderer: () => null,
        helpers: {
            buildPeerUrl: (p: string) => p,
            loadModule: async () => ({}),
            buildRepoHeaders: () => ({})
        },
        onElement: () => { }
    }

    const loader = new HookLoader({
        host: 'localhost:8083',
        protocol: 'http' as const,
        moduleLoader: new WebModuleLoader(),
        transpiler: async (code: string) => code
    })

    const promises = [
        loader.loadModule('./test-module.js', '/hooks/client/get-client.jsx', mockContext),
        loader.loadModule('./test-module.js', '/hooks/client/get-client.jsx', mockContext),
        loader.loadModule('./test-module.js', '/hooks/client/get-client.jsx', mockContext)
    ]

    await Promise.all(promises)

    const uniqueUrls = [...new Set(fetchCalls)]
    assert.strictEqual(uniqueUrls.length, 1,
        `Expected 1 unique fetch, got ${uniqueUrls.length}: ${JSON.stringify(fetchCalls)}`)
})

test('HookLoader should normalize relative and absolute paths to the same module', async () => {
    const fetchCalls: string[] = []
    const mockFetch = async (url: string) => {
        fetchCalls.push(url)
        return {
            ok: true,
            headers: { get: () => 'application/javascript' },
            text: async () => 'export default function Plugin() { return "plugin" }'
        }
    }
    globalThis.fetch = mockFetch as any

    const { HookLoader, WebModuleLoader } = await import('../../dist/web/runtimeLoader.js')

    const mockContext = {
        React: { createElement: () => ({}) },
        createElement: () => ({}),
        FileRenderer: () => null,
        helpers: {
            buildPeerUrl: (p: string) => p,
            loadModule: async () => ({}),
            buildRepoHeaders: () => ({})
        },
        onElement: () => { }
    }

    const loader = new HookLoader({
        host: 'localhost:8083',
        protocol: 'http' as const,
        moduleLoader: new WebModuleLoader(),
        transpiler: async (code: string) => code
    })

    loader.clearCache()

    const result1 = await loader.loadModule(
        './plugin/tmdb.mjs',
        '/hooks/client/get-client.jsx',
        mockContext
    )

    const result2 = await loader.loadModule(
        '/hooks/client/plugin/tmdb.mjs',
        '/hooks/client/get-client.jsx',
        mockContext
    )

    assert.strictEqual(fetchCalls.length, 1,
        `Expected 1 fetch call, got ${fetchCalls.length}: ${JSON.stringify(fetchCalls)}`)

    assert.strictEqual(result1, result2, 'Results should be identical (same cached module)')
})

test('HookLoader should handle complex relative path normalization', async () => {
    const { HookLoader, WebModuleLoader } = await import('../../dist/web/runtimeLoader.js')

    const mockContext = {
        React: { createElement: () => ({}) },
        createElement: () => ({}),
        FileRenderer: () => null,
        helpers: {
            buildPeerUrl: (p: string) => p,
            loadModule: async () => ({}),
            buildRepoHeaders: () => ({})
        },
        onElement: () => { }
    }

    const loader = new HookLoader({
        host: 'localhost:8083',
        protocol: 'http' as const,
        moduleLoader: new WebModuleLoader(),
        transpiler: async (code: string) => code
    })

    const normalize = (loader as any).normalizeToAbsolutePath.bind(loader)

    const testCases: Array<[string, string, string]> = [
        ['./plugin/tmdb.mjs', '/hooks/client/get-client.jsx', '/hooks/client/plugin/tmdb.mjs'],
        ['../plugin/tmdb.mjs', '/hooks/client/sub/page.jsx', '/hooks/client/plugin/tmdb.mjs'],
        ['/hooks/client/plugin/tmdb.mjs', '/hooks/client/get-client.jsx', '/hooks/client/plugin/tmdb.mjs'],
        ['./foo/../bar.js', '/hooks/client/test.jsx', '/hooks/client/bar.js'],
        ['../../other.js', '/hooks/client/a/b/c.jsx', '/hooks/client/other.js']
    ]

    for (const [input, fromPath, expected] of testCases) {
        const result = normalize(input, fromPath)
        assert.strictEqual(result, expected,
            `normalize('${input}', '${fromPath}') should equal '${expected}', got '${result}'`)
    }
})

test('HookLoader should cache promise and prevent race conditions', async () => {
    let fetchCount = 0
    const mockFetch = async (url: string) => {
        fetchCount++
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
            ok: true,
            headers: { get: () => 'application/javascript' },
            text: async () => `export default function Module${fetchCount}() { return ${fetchCount} }`
        }
    }
    globalThis.fetch = mockFetch as any

    const { HookLoader, WebModuleLoader } = await import('../../dist/web/runtimeLoader.js')

    const mockContext = {
        React: { createElement: () => ({}) },
        createElement: () => ({}),
        FileRenderer: () => null,
        helpers: {
            buildPeerUrl: (p: string) => p,
            loadModule: async () => ({}),
            buildRepoHeaders: () => ({})
        },
        onElement: () => { }
    }

    const loader = new HookLoader({
        host: 'localhost:8083',
        protocol: 'http' as const,
        moduleLoader: new WebModuleLoader(),
        transpiler: async (code: string) => code
    })

    loader.clearCache()

    const promise1 = loader.loadModule('./slow-module.js', '/hooks/client/test.jsx', mockContext)
    const promise2 = loader.loadModule('./slow-module.js', '/hooks/client/test.jsx', mockContext)
    const promise3 = loader.loadModule('./slow-module.js', '/hooks/client/test.jsx', mockContext)

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])

    assert.strictEqual(fetchCount, 1, `Expected 1 fetch, got ${fetchCount}`)
    assert.strictEqual(result1, result2, 'result1 should equal result2')
    assert.strictEqual(result2, result3, 'result2 should equal result3')
})

test('HookLoader should clear both moduleCache and pendingFetches on clearCache', async () => {
    let fetchCallCount = 0
    const mockFetch = async () => {
        fetchCallCount++
        return {
            ok: true,
            headers: { get: () => 'application/javascript' },
            text: async () => 'export default function Test() { return "test" }'
        }
    }
    globalThis.fetch = mockFetch as any

    const { HookLoader, WebModuleLoader } = await import('../../dist/web/runtimeLoader.js')

    const mockContext = {
        React: { createElement: () => ({}) },
        createElement: () => ({}),
        FileRenderer: () => null,
        helpers: {
            buildPeerUrl: (p: string) => p,
            loadModule: async () => ({}),
            buildRepoHeaders: () => ({})
        },
        onElement: () => { }
    }

    const loader = new HookLoader({
        host: 'localhost:8083',
        protocol: 'http' as const,
        moduleLoader: new WebModuleLoader(),
        transpiler: async (code: string) => code
    })

    await loader.loadModule('./module1.js', '/hooks/client/test.jsx', mockContext)

    const callsBeforeClear = fetchCallCount

    loader.clearCache()

    await loader.loadModule('./module1.js', '/hooks/client/test.jsx', mockContext)

    const callsAfterClear = fetchCallCount

    assert.strictEqual(callsAfterClear, callsBeforeClear + 1, 'Should fetch again after clearCache')
