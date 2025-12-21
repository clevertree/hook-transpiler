import React, { useEffect } from 'react';
export const TSDiv = ({ children, tag = 'div', onElement, ...props }) => {
    useEffect(() => {
        if (onElement) {
            try {
                onElement(tag, props);
            }
            catch (e) {
                // no-op
            }
        }
    }, [props.className, tag, onElement]);
    const voidElements = ['img', 'input', 'br', 'hr', 'area', 'base', 'col', 'embed', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
    if (voidElements.includes(tag)) {
        return React.createElement(tag, props);
    }
    return React.createElement(tag, props, children);
};
//# sourceMappingURL=TSDiv.js.map