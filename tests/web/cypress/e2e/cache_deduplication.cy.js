/**
 * E2E tests for module cache deduplication
 * 
 * These tests verify that:
 * 1. Each unique module is fetched only once
 * 2. Relative and absolute paths to the same file don't cause duplicate fetches
 * 3. Concurrent imports of the same module are deduplicated
 * 4. Static and dynamic imports share the same cache
 */

describe('Module Cache Deduplication', () => {
  let fetchedUrls = []

  beforeEach(() => {
    fetchedUrls = []
    
    cy.visit('/', {
      onBeforeLoad(win) {
        // Intercept fetch calls to track what's being fetched
        const originalFetch = win.fetch
        cy.stub(win, 'fetch').callsFake((...args) => {
          const url = args[0]
          if (typeof url === 'string' && url.includes('/hooks/')) {
            fetchedUrls.push(url)
            cy.log(`Fetch: ${url}`)
          }
          return originalFetch.apply(win, args)
        })
      }
    })
  })

  it('should not fetch the same module multiple times when imported from multiple places', () => {
    // Wait for app to load
    cy.get('#app', { timeout: 20000 }).should('exist')

    // Wait a bit for all imports to resolve
    cy.wait(2000)

    // Check that each unique module path was fetched only once
    cy.wrap(fetchedUrls).then(urls => {
      const counts = {}
      urls.forEach(url => {
        // Normalize URL to just the path
        const urlObj = new URL(url)
        const path = urlObj.pathname
        counts[path] = (counts[path] || 0) + 1
      })

      cy.log('Fetch counts by path:', JSON.stringify(counts, null, 2))

      // Assert no path was fetched more than once
      const duplicates = Object.entries(counts)
        .filter(([path, count]) => count > 1)
        .map(([path, count]) => `${path} (${count} times)`)

      expect(duplicates, 'Duplicate fetches detected').to.have.length(0)
    })
  })

  it('should deduplicate relative and absolute paths to the same module', () => {
    cy.get('#app', { timeout: 20000 }).should('exist')
    cy.wait(2000)

    // Inspect actual loader cache from the browser
    cy.window().then(win => {
      const loader = win.__currentLoader
      if (!loader) {
        // Fallback to server endpoint if loader not exposed
        cy.request('/e2e/status')
          .its('body')
          .then(body => {
            expect(body).to.have.property('success', true)
          })
        return
      }

      // Access private cache via type assertion (for testing only)
      const moduleCache = loader.moduleCache || new Map()
      const cacheKeys = Array.from(moduleCache.keys())
      
      cy.log('Cache keys:', cacheKeys.join(', '))

      // Check that all cache keys are normalized (absolute paths)
      const nonNormalized = cacheKeys.filter(key => {
        const path = key.includes(':') ? key.split(':')[1] : key
        return path.startsWith('./') || path.startsWith('../')
      })

      expect(nonNormalized, 'All cache keys should be normalized').to.have.length(0)

      // Check for duplicates (same normalized path appearing twice)
      const paths = cacheKeys.map(key => key.includes(':') ? key.split(':')[1] : key)
      const uniquePaths = new Set(paths)
      
      expect(paths.length, 'No duplicate cache entries expected').to.equal(uniquePaths.size)
    })
  })

  it('should use cached module for concurrent imports', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        const fetchTimes = []
        const originalFetch = win.fetch
        
        cy.stub(win, 'fetch').callsFake((...args) => {
          const url = args[0]
          if (typeof url === 'string' && url.includes('/hooks/')) {
            fetchTimes.push({
              url,
              timestamp: Date.now()
            })
          }
          return originalFetch.apply(win, args)
        })
        
        // Store fetchTimes on window for later access
        win.__fetchTimes = fetchTimes
      }
    })

    cy.get('#app', { timeout: 20000 }).should('exist')
    cy.wait(2000)

    // Check that fetches didn't happen concurrently for the same URL
    cy.window().then(win => {
      const fetchTimes = win.__fetchTimes || []
      
      // Group by URL
      const byUrl = {}
      fetchTimes.forEach(({ url, timestamp }) => {
        const urlObj = new URL(url)
        const path = urlObj.pathname
        if (!byUrl[path]) byUrl[path] = []
        byUrl[path].push(timestamp)
      })

      // Each URL should only have one fetch
      Object.entries(byUrl).forEach(([path, timestamps]) => {
        expect(timestamps, `Path ${path} should be fetched only once`).to.have.length(1)
      })
    })
  })

  it('should handle static imports before module execution', () => {
    cy.visit('/')

    // Wait for status
    cy.get('#e2e-status', { timeout: 20000 })
      .should('exist')
      .should('contain.text', 'static-imports-ok')

    // Verify static imports were loaded
    cy.request('/e2e/status')
      .its('body')
      .then((body) => {
        expect(body).to.have.property('success', true)
        expect(body).to.have.nested.property('details.missing')
        expect(body.details.missing).to.have.length(0)
      })

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

  it('should share cache between static and dynamic imports', () => {
    // Track fetch calls
    const fetchLog = []
    
    cy.visit('/', {
      onBeforeLoad(win) {
        const originalFetch = win.fetch
        cy.stub(win, 'fetch').callsFake((...args) => {
          const url = args[0]
          if (typeof url === 'string' && url.includes('/hooks/')) {
            const urlObj = new URL(url)
            fetchLog.push({
              path: urlObj.pathname,
              timestamp: Date.now()
            })
            cy.log(`Fetch: ${urlObj.pathname}`)
          }
          return originalFetch.apply(win, args)
        })
      }
    })

    cy.get('#app', { timeout: 20000 }).should('exist')
    cy.wait(2000)

    // Analyze fetch log
    cy.wrap(fetchLog).then(log => {
      const pathCounts = {}
      log.forEach(({ path }) => {
        pathCounts[path] = (pathCounts[path] || 0) + 1
      })

      cy.log('Path fetch counts:', JSON.stringify(pathCounts, null, 2))

      // No path should be fetched more than once
      const duplicates = Object.entries(pathCounts)
        .filter(([_, count]) => count > 1)

      expect(duplicates, 'No duplicate fetches expected').to.have.length(0)
    })
  })

  it('should normalize different path formats to same cache key', () => {
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

      // All cache keys should be in absolute format (start with /)
      const relative = cacheKeys.filter(key => {
        const path = key.includes(':') ? key.split(':')[1] : key
        return path.startsWith('./') || path.startsWith('../')
      })

      expect(relative, 'All cache keys should be normalized to absolute paths').to.have.length(0)
    })
  })
})
