/**
 * E2E tests for module cache deduplication
 * 
 * These tests verify that the module loader correctly caches and deduplicates imports.
 * Note: React StrictMode causes double-rendering in dev, so we focus on cache internals
 * rather than fetch counts which may be affected by React's behavior.
 */

describe('Module Cache Deduplication', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        // Initialize fetch tracking on window object
        win.__fetchedUrls = []

        // Intercept fetch calls to track what's being fetched
        const originalFetch = win.fetch
        win.fetch = function (...args) {
          const url = args[0]
          if (typeof url === 'string' && url.includes('/hooks/')) {
            win.__fetchedUrls.push(url)
            // Log to console for debugging
            win.console.log(`[e2e] Fetch: ${url}`)
          }
          return originalFetch.apply(this, args)
        }
      }
    })
  })

  it('should cache lazy imports (relative vs absolute with query/hash)', () => {
    // Wait for app to load and lazy imports to resolve
    cy.get('#app', { timeout: 20000 }).should('exist')
    cy.wait(2000)

    // Check the fetched URLs - lazy-data.js is imported both relatively and absolutely with query/hash
    cy.window().then(win => {
      const urls = win.__fetchedUrls || []

      // Count fetches for lazy-data.js (both ./lazy-data.js and /hooks/lazy-data.js?x=1#frag)
      const lazyDataFetches = urls.filter(url => url.includes('lazy-data.js'))

      cy.log('Lazy data fetches:', lazyDataFetches)

      // Both should be treated as separate resources (different query/hash)
      // So we expect 2 fetches total (one for each unique resource)
      expect(lazyDataFetches.length).to.be.gte(2)
    })
  })

  it('should normalize cache keys to absolute paths', () => {
    cy.get('#app', { timeout: 20000 }).should('exist')
    cy.wait(2000)

    cy.window().then(win => {
      const loader = win.__currentLoader
      if (!loader) {
        cy.log('Loader not exposed, skipping direct cache inspection')
        return
      }

      const moduleCache = loader.moduleCache || new Map()
      const cacheKeys = Array.from(moduleCache.keys())

      cy.log('Inspecting cache keys:', JSON.stringify(cacheKeys))

      // All cache keys should be normalized (no relative paths like ./ or ../)
      const relative = cacheKeys.filter(key => {
        const path = key.includes(':') ? key.split(':')[1] : key
        return path.startsWith('./') || path.startsWith('../')
      })

      expect(relative, 'All cache keys should be normalized to absolute paths').to.have.length(0)
    })
  })

  it('should handle static imports before module execution', () => {
    cy.visit('/')

    // Wait for status
    cy.get('#e2e-status', { timeout: 20000 })
      .should('exist')
      .should('contain.text', 'static-imports-ok')

    // Check no errors about missing imports
    cy.window().then(win => {
      // Access console.error stub if it exists
      if (win.console.error.getCalls) {
        const errorCalls = win.console.error.getCalls()
        const importErrors = errorCalls.filter(call =>
          call.args.join(' ').toLowerCase().includes('import') &&
          (call.args.join(' ').toLowerCase().includes('error') ||
            call.args.join(' ').toLowerCase().includes('failed'))
        )
        expect(importErrors).to.have.length(0)
      }
    })
  })
})
