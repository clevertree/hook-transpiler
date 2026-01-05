import { describe, test } from 'node:test';
import assert from 'node:assert';
/**
 * Tests for runtimeLoader JSX automatic runtime wrapper
 *
 * Verifies that the jsx wrapper correctly handles the automatic JSX runtime
 * signature where the third parameter is the key, not a child.
 */
describe('runtimeLoader - JSX Automatic Runtime', () => {
    // Mock React for testing
    const mockReact = {
        createElement: (type, props, ...children) => {
            return {
                type,
                props: {
                    ...props,
                    children: children.length > 0 ? children : props?.children,
                },
                key: props?.key || null,
                ref: props?.ref || null,
            };
        },
        Fragment: Symbol('Fragment'),
    };
    // This is the wrapper function from runtimeLoader.ts
    const createJsxFactory = (React) => {
        if (!React || !React.createElement)
            return undefined;
        return (type, config, maybeKey) => {
            let key = null;
            if (maybeKey !== undefined) {
                key = String(maybeKey);
            }
            if (config && 'key' in config) {
                key = String(config.key);
                // Remove key from config before passing to createElement
                const { key: _k, ...propsWithoutKey } = config;
                return React.createElement(type, { ...propsWithoutKey, key }, undefined);
            }
            // Pass key separately
            return React.createElement(type, { ...config, key }, undefined);
        };
    };
    test('creates jsx factory from React', () => {
        const jsxFactory = createJsxFactory(mockReact);
        assert.ok(jsxFactory);
        assert.strictEqual(typeof jsxFactory, 'function');
    });
    test('handles key from third parameter', () => {
        const jsxFactory = createJsxFactory(mockReact);
        const element = jsxFactory('div', { children: 'hello' }, 'key-1');
        assert.strictEqual(element.key, 'key-1');
        assert.strictEqual(element.props.children, 'hello');
    });
    test('converts numeric key to string', () => {
        const jsxFactory = createJsxFactory(mockReact);
        const element = jsxFactory('div', { children: 'hello' }, 123);
        assert.strictEqual(element.key, '123');
    });
    test('prefers key from third parameter over config.key', () => {
        const jsxFactory = createJsxFactory(mockReact);
        const element = jsxFactory('div', { children: 'hello', key: 'config-key' }, 'param-key');
        assert.strictEqual(element.key, 'param-key');
    });
    test('handles key in config when no third parameter', () => {
        const jsxFactory = createJsxFactory(mockReact);
        const element = jsxFactory('div', { children: 'hello', key: 'config-key' }, undefined);
        assert.strictEqual(element.key, 'config-key');
    });
    test('removes key from config before passing to createElement', () => {
        const jsxFactory = createJsxFactory(mockReact);
        const element = jsxFactory('div', { children: 'hello', key: 'config-key', className: 'test' }, undefined);
        // The key should be set on element but not in props
        assert.strictEqual(element.key, 'config-key');
        assert.strictEqual(element.props.key, undefined);
        assert.strictEqual(element.props.className, 'test');
    });
    test('handles .map() scenario with numeric items as keys', () => {
        const jsxFactory = createJsxFactory(mockReact);
        // Simulate what the transpiler produces: items.map((item) => _jsx("div", { children: item }, item))
        const items = [1, 2, 3];
        const elements = items.map((item) => jsxFactory('div', { children: item }, item));
        assert.strictEqual(elements.length, 3);
        elements.forEach((el, idx) => {
            assert.strictEqual(el.key, String(items[idx]));
            assert.strictEqual(el.props.children, items[idx]);
        });
    });
    test('handles .map() scenario with object keys', () => {
        const jsxFactory = createJsxFactory(mockReact);
        // Simulate: movies.map((movie) => _jsx("div", { children: movie.title }, String(movie.id)))
        const movies = [
            { id: 1, title: 'Movie 1' },
            { id: 2, title: 'Movie 2' },
        ];
        const elements = movies.map((movie) => jsxFactory('div', { children: movie.title }, String(movie.id)));
        assert.strictEqual(elements.length, 2);
        assert.strictEqual(elements[0].key, '1');
        assert.strictEqual(elements[0].props.children, 'Movie 1');
        assert.strictEqual(elements[1].key, '2');
        assert.strictEqual(elements[1].props.children, 'Movie 2');
    });
    test('returns undefined factory for missing React', () => {
        const jsxFactory = createJsxFactory(null);
        assert.strictEqual(jsxFactory, undefined);
    });
    test('returns undefined factory for React without createElement', () => {
        const jsxFactory = createJsxFactory({});
        assert.strictEqual(jsxFactory, undefined);
    });
    test('preserves other props when key is extracted', () => {
        const jsxFactory = createJsxFactory(mockReact);
        const element = jsxFactory('div', {
            children: 'hello',
            className: 'test-class',
            id: 'test-id',
            key: 'my-key',
        }, undefined);
        assert.strictEqual(element.key, 'my-key');
        assert.strictEqual(element.props.className, 'test-class');
        assert.strictEqual(element.props.id, 'test-id');
        assert.strictEqual(element.props.children, 'hello');
        assert.strictEqual(element.props.key, undefined); // key should not be in props
    });
});
//# sourceMappingURL=runtimeLoader.test.js.map