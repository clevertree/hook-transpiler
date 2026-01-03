import React, { useState } from 'react';

export default function ArrayTest() {
    const [items, setItems] = useState([
        { id: 1, name: 'React' },
        { id: 2, name: 'WASM' },
        { id: 3, name: 'Rust' }
    ]);

    const addItem = () => {
        const names = ['Kotlin', 'Swift', 'JSC', 'SWC', 'Relay'];
        const name = names[Math.floor(Math.random() * names.length)];
        const newId = Date.now();
        setItems([{ id: newId, name }, ...items]);
    };

    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    return (
        <div className="p-4 bg-surface rounded-xl border-themed shadow-sm">
            <h2 className="text-lg font-bold mb-2 text-themed">Array Rendering</h2>
            <p className="text-sm text-muted mb-4">Tests: .map(), keys, list updates</p>

            <div className="space-y-4">
                <button
                    onClick={addItem}
                    className="bg-primary text-white px-4 py-2 rounded-md shadow-sm w-full font-medium"
                >
                    Add Random Tech
                </button>

                <div className="space-y-2">
                    {items.map(item => (
                        <div
                            key={item.id}
                            className="p-3 rounded-lg flex flex-row items-center justify-between bg-bg border-themed"
                        >
                            <span className="font-bold text-sm text-themed">{item.name}</span>
                            <button
                                onClick={() => removeItem(item.id)}
                                className="text-muted"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>

                {items.length === 0 && (
                    <div className="p-8 text-center text-muted italic text-sm">
                        List is empty
                    </div>
                )}
            </div>
        </div>
    );
}
