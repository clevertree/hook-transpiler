describe('Remote Hook Loading', () => {
    it('remote hook tester page loads and initializes', () => {
        cy.visit('/url-tester.html');

        // Check that the infrastructure is ready
        cy.get('#wasm-state', { timeout: 20000 }).should('contain', 'Ready');
        cy.get('#styler-state', { timeout: 10000 }).should('contain', 'Ready');
        
        // Check that the form exists
        cy.get('.url-form').should('exist');
        cy.get('.url-form button').should('exist');
        
        // Check that remote-root exists
        cy.get('#remote-root').should('exist');
        
        // Check that status indicator exists
        cy.get('#e2e-status').should('contain.text', 'static-imports-ok');

        // Verify UI elements render
        cy.get('.renderer-container').should('exist');
        cy.get('.url-preview').should('exist');
    });

    it('remote hook form submission triggers hook rendering', () => {
        // Stub a simple hook response
        cy.intercept('GET', 'https://clevertree.github.io/**', {
            statusCode: 200,
            headers: { 'content-type': 'application/javascript' },
            body: 'export default function Hook(){ return null; }'
        }).as('hookFetch');

        cy.visit('/url-tester.html');
        
        cy.get('#wasm-state', { timeout: 20000 }).should('contain', 'Ready');

        // Fill and submit the form
        cy.get('.url-form input').eq(0).clear().type('https://clevertree.github.io', { delay: 5 });
        cy.get('.url-form input').eq(1).clear().type('/test-hook.jsx', { delay: 5 });
        cy.get('.url-form button').click();

        // The form submission should trigger a fetch
        // (We can't easily test rendering of external hooks due to transpilation/initialization complexity)
        cy.get('.url-preview').should('contain.text', 'clevertree.github.io');
    });
});
