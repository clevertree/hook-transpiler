import React from 'react';

export default function StylingTest() {
    return (
        <div className="p-4 bg-surface rounded-xl border-themed shadow-sm">
            <h2>Styling & Themes</h2>
            <p className="text-sm text-muted mb-4">Tests: className, themed-styler, dynamic styles</p>

            <div className="space-y-4 mb-6">
                <h1>Header 1</h1>
                <h2>Header 2</h2>
                <h3>Header 3</h3>
                <h4>Header 4</h4>
                <h5>Header 5</h5>
                <h6>Header 6</h6>
            </div>

            <div className="space-y-4">
                <div className="p-4 rounded-lg bg-bg border-themed">
                    <p className="text-primary font-medium">Themed Box</p>
                    <p className="text-xs text-muted">Using Tailwind-like classes</p>
                </div>

                <div className="flex flex-row space-x-2">
                    <button className="bg-primary text-white px-4 py-2 rounded-md shadow-sm font-medium">
                        Primary
                    </button>
                    <button className="bg-surface text-themed px-4 py-2 rounded-md shadow-sm border-themed">
                        Secondary
                    </button>
                </div>

                <div className="mt-4 p-3 bg-bg rounded border border-dashed border-themed">
                    <p className="text-center text-muted italic text-sm">
                        Switch theme at the top to see changes
                    </p>
                </div>
            </div>
        </div>
    );
}
