describe('Operator tokens and parsing', () => {
    it('lazy-data.js includes equality operators (detect presence)', () => {
        const url = '/hooks/lazy-data.js';
        const equalityOps = ['!==', '===', '!=', '=='];
        const relationalOps = ['<=', '>=', '<', '>'];

        cy.request(url).then((resp) => {
            expect(resp.status).to.eq(200);
            const body = String(resp.body);

            // At least one equality operator should be present (e.g., !==)
            const hasAnyEquality = equalityOps.some((op) => body.includes(op));
            expect(hasAnyEquality, `${url} should include at least one equality operator`).to.be.true;

            // Specifically detect '!==' since this is the regression of interest
            expect(body.includes('!=='), `${url} should include '!==` + `'`).to.be.true;

            // Log which relational operators are present for debugging
            const presentRel = relationalOps.filter((op) => body.includes(op));
            cy.log(`Present relational ops in ${url}: ${presentRel.join(', ') || 'none'}`);
        });
    });

    it("doesn't report 'Unexpected token' for equality operators in console", () => {
        cy.visit('/', {
            onBeforeLoad(win) {
                cy.stub(win.console, 'error').as('consoleError');
                cy.stub(win.console, 'log').as('consoleLog');
            },
        });

        cy.get('#wasm-state', { timeout: 20000 }).should('contain', 'Ready');

        // Gather logs and assert no parse errors for operator tokens
        cy.get('@consoleError').then((stub) => {
            const calls = stub.getCalls().map((c) => c.args.join(' ')).join('\n');
            const unexpectedToken = /Unexpected token\s*(?:!===|!==|===|==|!=)/i;
            expect(calls).to.not.match(unexpectedToken);
        });
    });
});
