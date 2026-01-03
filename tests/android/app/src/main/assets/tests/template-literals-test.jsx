import React, { useState } from 'react';

export default function TemplateLiteralsTest() {
    const [name, setName] = useState('User');
    const [count, setCount] = useState(5);

    const greeting = `Hello, ${name}!`;
    const message = `You have ${count} ${count === 1 ? 'item' : 'items'}.`;
    const multiline = `This is line 1
This is line 2
Count: ${count}`;

    return (
        <div className="test-section">
            <h2>Template Literals Test</h2>
            <p>Tests: Template literal syntax, expression interpolation, multi-line strings</p>

            <div className="test-case">
                <h3>{greeting}</h3>
                <p>{message}</p>
                <pre>{multiline}</pre>

                <button onClick={() => setCount(count + 1)} className="btn">
                    Increment Count
                </button>

                <button onClick={() => setName(name === 'User' ? 'Developer' : 'User')} className="btn">
                    Toggle Name
                </button>
            </div>
        </div>
    );
}
