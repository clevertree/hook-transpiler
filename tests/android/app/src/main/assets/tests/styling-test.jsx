import React from 'react';

export default function StylingTest() {
    return (
        <div className="p-2">
            <h2 className="text-lg font-bold mb-2">Styling & Themes</h2>
            <p className="text-sm text-gray-600 mb-4">Tests: className, themed-styler, dynamic styles</p>

            <div className="space-y-4">
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-blue-800 font-medium">Blue Themed Box</p>
                    <p className="text-xs text-blue-600">Using Tailwind-like classes</p>
                </div>

                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-green-800 font-medium">Green Themed Box</p>
                    <p className="text-xs text-green-600">Using Tailwind-like classes</p>
                </div>

                <div className="flex flex-row space-x-2">
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm">
                        Primary
                    </button>
                    <button className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md shadow-sm">
                        Secondary
                    </button>
                </div>

                <div className="mt-4 p-3 bg-gray-100 rounded border border-dashed border-gray-400">
                    <p className="text-center text-gray-500 italic text-sm">
                        Switch theme at the top to see changes
                    </p>
                </div>
            </div>
        </div>
    );
}
