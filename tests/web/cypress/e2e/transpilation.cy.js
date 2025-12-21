describe('Hook Transpilation and Rendering', () => {
  it('should load WASM, transpile the hook, and render content', () => {
    cy.visit('/');
    
    cy.get('body').then(($body) => {
      const text = $body.text();
      cy.task('log', 'PAGE BODY TEXT: ' + text);
    });

    // Wait for WASM to be ready
    cy.get('#wasm-state', { timeout: 15000 }).should('contain', 'Ready');
    
    // Wait for hook content to be rendered
    cy.contains('Hello from Test Hook!', { timeout: 10000 }).should('be.visible');
    cy.contains('This hook was transpiled and rendered by HookRenderer.').should('be.visible');
    
    // Check if the div with Tailwind class exists
    cy.get('.bg-blue-500').should('exist');
    
    console.log('E2E Test Passed!');
  });
});
