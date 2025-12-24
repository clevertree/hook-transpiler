describe('Hook Transpiler Metadata Extraction', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.stub(win.console, 'log').as('consoleLog')
        cy.stub(win.console, 'error').as('consoleError')
      }
    })

    cy.get('#wasm-state', { timeout: 20000 }).should('contain', 'Ready')
  })

  it('extracts react import metadata', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win
      expect(typeof __hook_transpile_jsx_with_metadata).to.equal('function')

      const source = `import React from 'react'
<div>Hello</div>`

      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')
      expect(result.code).to.be.a('string')
      expect(result.metadata).to.be.an('object')
      expect(result.metadata.imports).to.be.an('array')
      expect(result.metadata.imports.length).to.equal(1)

      const reactImport = result.metadata.imports[0]
      expect(reactImport.source).to.equal('react')
      expect(reactImport.kind.type).to.equal('SpecialPackage')
      expect(reactImport.bindings).to.be.an('array')
      expect(reactImport.bindings[0].binding_type.type).to.equal('Default')
      expect(reactImport.bindings[0].name).to.equal('React')
      expect(result.metadata.has_jsx).to.equal(true)
    })
  })

  it('extracts special package imports', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      const source = `import { MarkdownRenderer } from '@clevertree/markdown'
import { dirname } from '@clevertree/meta'
import { FileRenderer } from '@clevertree/file-renderer'
<div>Content</div>`

      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')
      expect(result.metadata.imports.length).to.equal(3)

      const sources = result.metadata.imports.map(i => i.source)
      expect(sources).to.include('@clevertree/markdown')
      expect(sources).to.include('@clevertree/meta')
      expect(sources).to.include('@clevertree/file-renderer')

      // All special packages should have 'SpecialPackage' kind
      for (const imp of result.metadata.imports) {
        expect(imp.kind.type).to.equal('SpecialPackage')
      }
    })
  })

  it('extracts named imports correctly', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      const source = `import { useState, useEffect } from 'react'
<div>Test</div>`

      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')
      expect(result.metadata.imports.length).to.equal(1)

      const reactImport = result.metadata.imports[0]
      expect(reactImport.bindings.length).to.equal(2)
      expect(reactImport.bindings[0].binding_type.type).to.equal('Named')
      const names = reactImport.bindings.map(b => b.name)
      expect(names).to.have.members(['useState', 'useEffect'])
    })
  })

  it('detects local module imports', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      const source = `import { helper } from './utils.js'
import Default from '../lib/index.js'
<div>Test</div>`

      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')
      expect(result.metadata.imports.length).to.equal(2)

      const sources = result.metadata.imports.map(i => i.source)
      expect(sources).to.include('./utils.js')
      expect(sources).to.include('../lib/index.js')

      // All local imports should be 'Module' kind
      for (const imp of result.metadata.imports) {
        expect(imp.kind.type).to.equal('Module')
      }
    })
  })

  it('detects dynamic imports', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      const source = `const mod = await import('./utils.js')
<div>Test</div>`

      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')
      expect(result.metadata.has_dynamic_import).to.equal(true)
      expect(result.metadata.has_jsx).to.equal(true)
    })
  })

  it('handles mixed imports correctly', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      const source = `import React from 'react'
import { MarkdownRenderer } from '@clevertree/markdown'
import { helper } from './utils.js'
const mod = await import('./plugin.js')
<div>Test {helper()}</div>`

      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')
      expect(result.metadata.imports.length).to.be.at.least(3)
      expect(result.metadata.has_jsx).to.equal(true)
      expect(result.metadata.has_dynamic_import).to.equal(true)

      // Check that we have all kinds
      const kinds = result.metadata.imports.map(i => i.kind.type)
      expect(kinds).to.include('SpecialPackage')
      expect(kinds).to.include('Module')
    })
  })

  it('includes version in metadata', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      const source = '<div>Test</div>'
      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')

      expect(result.metadata.version).to.be.a('string')
      expect(result.metadata.version.length).to.be.greaterThan(0)
    })
  })

  it('transpiles JSX correctly with metadata', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      const source = `import React from 'react'
<div className="test">Hello</div>`

      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')

      // Should still transpile JSX correctly
      expect(result.code).to.include('__hook_jsx_runtime.jsx')
      expect(result.code).to.include('div')
      expect(result.code).to.include('test')

      // Metadata should be present
      expect(result.metadata).to.exist
      expect(result.metadata.has_jsx).to.equal(true)
    })
  })

  it('handles errors correctly', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      // Invalid JSX that might cause issues
      const source = '<div unclosed>'
      const result = __hook_transpile_jsx_with_metadata(source, 'test.jsx')

      // Should handle gracefully - either with code or error in metadata
      expect(result).to.be.an('object')
      if (result.error) {
        expect(result.error).to.be.a('string')
      }
    })
  })

  it('correctly identifies modules without JSX', () => {
    cy.window().then((win) => {
      const { __hook_transpile_jsx_with_metadata } = win

      const source = `import { helper } from './utils.js'
const x = helper()`

      const result = __hook_transpile_jsx_with_metadata(source, 'test.js')

      expect(result.metadata.has_jsx).to.equal(false)
      expect(result.metadata.has_dynamic_import).to.equal(false)
      expect(result.metadata.imports.length).to.be.greaterThan(0)
    })
  })
})
