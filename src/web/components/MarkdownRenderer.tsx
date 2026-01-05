import React, { useEffect, useRef, useMemo } from 'react'

interface MarkdownRendererProps {
    content: string
    navigate?: (path: string) => void
    onElement?: (tag: string, props: any) => void
    overrides?: any
}

function renderAst(nodes: any[], Act: any, overrides: any, onElement?: (tag: string, props: any) => void): any {
    if (!nodes || !Array.isArray(nodes)) return null;

    return nodes.map((node, index) => {
        if (node.type === 'text') {
            return node.content;
        }
        if (node.type === 'element') {
            const tag = node.tag;
            let props = { ...(node.props || {}), key: index };

            if (typeof tag === 'string' && onElement) {
                try { onElement(tag, props) } catch (e) { }
            }

            let component: any = tag;
            const override = overrides[tag];
            if (override) {
                if (override.component) {
                    component = override.component;
                    if (override.props) {
                        props = { ...props, ...override.props };
                    }
                } else {
                    component = override;
                }
            }

            const children = renderAst(node.children, Act, overrides);
            return Act.createElement(component, props, children);
        }
        return null;
    });
}

export function MarkdownRenderer({ content, navigate, onElement, overrides = {} }: MarkdownRendererProps) {
    const contentRef = useRef<HTMLDivElement>(null)

    const defaultOverrides = useMemo(() => ({
        h1: { component: 'h1' },
        h2: { component: 'h2' },
        h3: { component: 'h3' },
        h4: { component: 'h4' },
        h5: { component: 'h5' },
        h6: { component: 'h6' },
        p: { component: 'p' },
        span: { component: 'span' },
        strong: { component: 'strong' },
        em: { component: 'em' },
        code: { component: 'code' },
        del: { component: 'del' },
        ins: { component: 'ins' },
        div: { component: 'div' },
        img: { component: 'img' },
        a: { component: 'a' },
        ul: { component: 'ul' },
        ol: { component: 'ol' },
        li: { component: 'li' },
        table: { component: 'table' },
        thead: { component: 'thead' },
        tbody: { component: 'tbody' },
        tr: { component: 'tr' },
        th: { component: 'th' },
        td: { component: 'td' }
    }), []);

    const allOverrides = useMemo(() => ({ ...defaultOverrides, ...overrides }), [defaultOverrides, overrides]);
    const allowedTags = useMemo(() => Object.keys(allOverrides), [allOverrides]);

    const renderedContent = useMemo(() => {
        const parseFn = (globalThis as any).__hook_md2jsx_parse;
        if (typeof parseFn === 'function') {
            try {
                const ast = parseFn(content, allowedTags);
                return renderAst(ast, React, allOverrides, onElement);
            } catch (e) {
                console.error('[MarkdownRenderer] Error parsing markdown:', e);
                return content;
            }
        }
        return content;
    }, [content, allowedTags, allOverrides, onElement]);

    useEffect(() => {
        if (onElement) {
            onElement('div', { className: 'markdown-content' })
        }
    }, [onElement])

    useEffect(() => {
        if (!navigate) return
        const handleAnchorClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            const anchor = target.closest('a')
            if (!anchor) return
            const href = anchor.getAttribute('href')
            if (!href) return
            const isInternal = href.startsWith('/') || href.startsWith('.') ||
                (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:'))

            if (isInternal) {
                e.preventDefault()
                let resolvedPath = href
                if (href.startsWith('.')) {
                    const currentPath = window.location.pathname
                    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'))
                    resolvedPath = new URL(href, `http://localhost${basePath}/`).pathname
                }
                navigate(resolvedPath)
            }
        }

        const element = contentRef.current
        if (element) {
            element.addEventListener('click', handleAnchorClick as EventListener)
            return () => {
                element.removeEventListener('click', handleAnchorClick as EventListener)
            }
        }
    }, [navigate])

    return (
        <div ref={contentRef} className="markdown-content">
            {renderedContent}
        </div>
    )
}
