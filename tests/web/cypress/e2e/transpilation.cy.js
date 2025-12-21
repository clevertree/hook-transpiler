describe('Hook Transpilation and Rendering', () => {
  it('should load WASM, transpile the hook, and render content', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        // This is a common pattern to see browser logs in terminal
        cy.stub(win.console, 'log').as('consoleLog');
        cy.stub(win.console, 'error').as('consoleError');
      }
    });
    
    cy.get('#wasm-state', { timeout: 20000 }).should('contain', 'Ready');
    
    // Periodically check logs
    cy.get('@consoleLog').then(stub => {
        const calls = stub.getCalls();
        calls.forEach(call => {
            cy.task('log', '[CONSOLE LOG] ' + call.args.join(' '));
        });
    });
    cy.get('@consoleError').then(stub => {
        const calls = stub.getCalls();
        calls.forEach(call => {
            cy.task('log', '[CONSOLE ERROR] ' + call.args.join(' '));
        });
    });

    // Wait for hook content to be rendered
    cy.contains('Mapped Hierarchy Test', { timeout: 20000 }).should('be.visible');
    cy.contains('Item 1').should('be.visible');
    cy.contains('urgent').should('be.visible');
    cy.contains('Lazy Data:').should('be.visible');
    cy.contains('This string contains JSX-like text:').should('be.visible');
    
    console.log('E2E Test Passed!');
  });
});
