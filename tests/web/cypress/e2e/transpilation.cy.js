describe('Hook Transpilation and Rendering', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.stub(win.console, 'log').as('consoleLog')
        cy.stub(win.console, 'error').as('consoleError')
      }
    })

    cy.get('#wasm-state', { timeout: 20000 }).should('contain', 'Ready')
    cy.contains('Mapped Hierarchy Test', { timeout: 20000 }).should('be.visible')
    cy.contains('Item 1').should('be.visible')
    cy.contains('urgent').should('be.visible')
    cy.contains('Namespace Value:').should('be.visible')
    cy.contains('This string contains JSX-like text:').should('be.visible')
    cy.contains('Lazy Data:', { timeout: 20000 }).should('be.visible')
  })

  it('renders base content', () => {
    cy.contains('Namespace OK').should('be.visible')
  })

  it('loads lazy relative module', () => {
    cy.contains('Lazy data loaded successfully', { timeout: 15000 }).should('be.visible')
  })

  it('loads lazy absolute module with query/hash', () => {
    cy.contains('Absolute+QH OK', { timeout: 15000 }).should('be.visible')
  })

  it('loads nested lazy module', () => {
    cy.contains('Nested data OK', { timeout: 15000 }).should('be.visible')
  })

  it('loads index lazy module', () => {
    cy.contains('Index file OK', { timeout: 15000 }).should('be.visible')
  })
})

