describe('Remote Hook OPTIONS discovery', () => {
  const host = 'https://clevertree.github.io';
  const hookPath = '/relay-template/hooks/client/get-client.jsx';

  it('loads the remote hook via OPTIONS discovery without console errors', () => {
    // Stub discovery and hook fetch to avoid network/CORS flakiness
    cy.intercept('OPTIONS', `${host}/`, {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { hookPath }
    }).as('optionsDiscovery');

    cy.intercept('GET', `${host}${hookPath}`, {
      statusCode: 200,
      headers: { 'content-type': 'application/javascript' },
      body: 'export default function Hook(){ return <div data-cy="remote-hook">Remote Hook OK</div>; }'
    }).as('remoteHook');

    cy.visit('/url-tester.html', {
      onBeforeLoad(win) {
        cy.stub(win.console, 'error').as('consoleError');
        cy.stub(win.console, 'warn').as('consoleWarn');
      }
    });

    // Clear the path so HookRenderer uses OPTIONS discovery
    cy.get('.url-form input').eq(1).clear();
    cy.get('.url-form').submit();

    cy.wait('@optionsDiscovery');
    cy.wait('@remoteHook');

    cy.get('#e2e-status', { timeout: 20000 }).should('exist').should('contain.text', 'static-imports-ok');
    cy.get('[data-cy="remote-hook"]', { timeout: 20000 }).should('exist').and('contain.text', 'Remote Hook OK');

    cy.get('@consoleError').then((stub) => {
      expect(stub.getCalls().length, 'console.error calls').to.equal(0);
    });
  });
});
