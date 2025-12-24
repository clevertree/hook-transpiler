describe('String Keywords Transpilation', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.stub(win.console, 'log').as('consoleLog')
        cy.stub(win.console, 'error').as('consoleError')
      }
    })

    // Wait for WASM to be ready
    cy.get('#wasm-state', { timeout: 20000 }).should('contain', 'Ready')
  })

  it('renders paragraph with className containing reserved words', () => {
    // Test that the paragraph with text-xs text-gray-500 mb-2 classes renders correctly
    cy.contains('Select a theme for the application', { timeout: 10000 })
      .should('be.visible')
      .should('have.class', 'text-xs')
      .should('have.class', 'text-gray-500')
      .should('have.class', 'mb-2')
  })

  it('renders button with multiple space-separated classes', () => {
    cy.contains('Test Button with Classes', { timeout: 10000 })
      .should('be.visible')
      .should('have.class', 'px-3')
      .should('have.class', 'py-1')
      .should('have.class', 'bg-blue-600')
      .should('have.class', 'text-white')
      .should('have.class', 'rounded')
  })

  it('transpiles JSX-like syntax inside string literals correctly', () => {
    // Verify the existing test for JSX-like strings still works
    cy.contains('This string contains JSX-like text:', { timeout: 10000 })
      .should('be.visible')
      .parent()
      .should('contain', '<div>test</div>')
  })

  it('renders the string keywords test section', () => {
    // The section header rendered by the test app
    cy.contains('Reserved Keywords in strings Test', { timeout: 10000 })
      .should('be.visible')
      .should('have.class', 'font-semibold')
  })

  it('does not throw console errors during transpilation', () => {
    cy.get('@consoleError').then((stub) => {
      // Filter out known non-critical errors if any
      const calls = stub.getCalls()
      if (calls.length > 0) {
        const errors = calls.map(call => call.args[0])
        const criticalErrors = errors.filter(err => {
          const errStr = String(err)
          return !errStr.includes('Warning') &&
            !errStr.includes('Download') &&
            !errStr.includes('[') && // Log messages starting with [
            !errStr.match(/^\[/)
        })
        // Log errors for debugging
        if (criticalErrors.length > 0) {
          console.log('Critical errors found:', criticalErrors)
        }
        expect(criticalErrors).to.have.length(0)
      }
    })
  })
})
