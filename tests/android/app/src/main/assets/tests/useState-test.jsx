import React, { useState } from 'react';

export default function UseStateTest() {
    const [count, setCount] = useState(0);
    const [text, setText] = useState('Initial');

    return (
        <div className="p-2">
            <h2 className="text-lg font-bold mb-2 text-themed">useState Hook</h2>
            <p className="text-sm text-muted mb-4">Tests: State updates, multiple hooks, re-renders</p>

            <div className="space-y-6">
                <div className="bg-surface p-4 rounded-lg border-themed">
                    <h3 className="text-sm font-bold text-muted uppercase mb-2">Counter</h3>
                    <div className="flex flex-row items-center justify-between">
                        <span className="text-3xl font-bold text-primary">{count}</span>
                        <div className="flex flex-row space-x-2">
                            <button onClick={() => setCount(count - 1)} className="bg-bg border-themed px-3 py-1 rounded shadow-sm text-themed">-</button>
                            <button onClick={() => setCount(count + 1)} className="bg-bg border-themed px-3 py-1 rounded shadow-sm text-themed">+</button>
                            <button onClick={() => setCount(0)} className="bg-surface px-3 py-1 rounded shadow-sm text-xs text-muted">Reset</button>
                        </div>
                    </div>
                </div>

                <div className="bg-surface p-4 rounded-lg border-themed">
                    <h3 className="text-sm font-bold text-muted uppercase mb-2">Text Input</h3>
                    <div className="space-y-3">
                        <div className="bg-bg p-2 border-themed rounded text-themed min-h-[40px]">
                            {text}
                        </div>
                        <div className="flex flex-row space-x-2">
                            <button onClick={() => setText('Hello World!')} className="bg-primary text-white px-3 py-1 rounded text-xs font-medium">Set Hello</button>
                            <button onClick={() => setText('Relay Hook')} className="bg-primary text-white px-3 py-1 rounded text-xs font-medium">Set Relay</button>
                            <button onClick={() => setText('Initial')} className="bg-surface text-muted px-3 py-1 rounded text-xs font-medium">Reset</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
