import React from 'react';
import { MarkdownRenderer } from '@clevertree/markdown';

export default function MarkdownTest() {
    const content = `
# Markdown Test
This is a test of the **MarkdownRenderer** on Android.

## Features
- Standard tags (h1, p, etc.)
- **Bold** and *Italic* text
- [Links](https://google.com)
- Custom components: <CustomBox color="#3b82f6">I am a custom box!</CustomBox>

### Nested Markdown
<MarkdownRenderer content="#### I am nested markdown!" />

### Tables
| Feature | Status | Notes |
| :--- | :---: | ---: |
| Headers | ✅ | Working |
| Bold | ✅ | Working |
| Tables | 🆕 | Added |
  `;

    const CustomBox = ({ color, children }) => (
        <div style={{ backgroundColor: color, padding: 10, borderRadius: 8, marginVertical: 10 }}>
            <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{children}</span>
        </div>
    );

    return (
        <div className="p-4">
            <MarkdownRenderer
                content={content}
                overrides={{
                    CustomBox: { component: CustomBox }
                }}
            />
        </div>
    );
}
