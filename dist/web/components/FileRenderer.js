import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer.js';
export function FileRenderer({ content, contentType, onElement }) {
    useEffect(() => {
        if (onElement) {
            const lower = (contentType || '').toLowerCase();
            if (lower.startsWith('image/')) {
                onElement('div', { className: "flex justify-center" });
                onElement('img', { style: { maxWidth: '100%', height: 'auto' } });
            }
            else if (lower.includes('json') || (!lower.includes('markdown') && !lower.includes('md'))) {
                onElement('pre', {});
            }
        }
    }, [onElement, contentType]);
    const lower = (contentType || '').toLowerCase();
    if (lower.includes('markdown') || lower.includes('md')) {
        return _jsx(MarkdownRenderer, { content: content, onElement: onElement });
    }
    if (lower.startsWith('image/')) {
        const isDataUrl = content.startsWith('data:');
        const src = isDataUrl ? content : `data:${contentType};base64,${content}`;
        return (_jsx("div", { className: "flex justify-center", children: _jsx("img", { src: src, alt: "image", style: { maxWidth: '100%', height: 'auto' } }) }));
    }
    if (lower.includes('json')) {
        let pretty = content;
        try {
            pretty = JSON.stringify(JSON.parse(content), null, 2);
        }
        catch (e) {
            // ignore
        }
        return (_jsx("pre", { children: pretty }));
    }
    return (_jsx("pre", { children: content }));
}
//# sourceMappingURL=FileRenderer.js.map