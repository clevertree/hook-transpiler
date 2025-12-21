import { jsx as _jsx } from "react/jsx-runtime";
import Markdown from 'markdown-to-jsx';
import React, { useEffect, useRef } from 'react';
function preprocessHtmlForMarkdown(content) {
    let processed = content;
    processed = processed.replace(/<([^>]+?)>/g, (match) => {
        return match.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ');
    });
    return processed;
}
export function MarkdownRenderer({ content, navigate, onElement, overrides = {} }) {
    const contentRef = useRef(null);
    const processedContent = preprocessHtmlForMarkdown(content);
    useEffect(() => {
        if (onElement) {
            onElement('div', { className: 'markdown-content' });
        }
    }, [onElement]);
    useEffect(() => {
        if (!navigate)
            return;
        const handleAnchorClick = (e) => {
            const target = e.target;
            const anchor = target.closest('a');
            if (!anchor)
                return;
            const href = anchor.getAttribute('href');
            if (!href)
                return;
            const isInternal = href.startsWith('/') || href.startsWith('.') ||
                (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:'));
            if (isInternal) {
                e.preventDefault();
                let resolvedPath = href;
                if (href.startsWith('.')) {
                    const currentPath = window.location.pathname;
                    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                    resolvedPath = new URL(href, `http://localhost${basePath}/`).pathname;
                }
                navigate(resolvedPath);
            }
        };
        const element = contentRef.current;
        if (element) {
            element.addEventListener('click', handleAnchorClick);
            return () => {
                element.removeEventListener('click', handleAnchorClick);
            };
        }
    }, [navigate]);
    const defaultOverrides = {
        script: () => null,
        iframe: () => null,
        ...overrides
    };
    return (_jsx("div", { ref: contentRef, className: "markdown-content", children: _jsx(Markdown, { options: {
                overrides: defaultOverrides,
                createElement: (type, props, ...children) => {
                    if (typeof type === 'string' && onElement) {
                        try {
                            onElement(type, props);
                        }
                        catch (e) { }
                    }
                    return React.createElement(type, props, ...children);
                }
            }, children: processedContent }) }));
}
//# sourceMappingURL=MarkdownRenderer.js.map