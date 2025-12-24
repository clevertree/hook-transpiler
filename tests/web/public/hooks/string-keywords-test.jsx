// Test hook for verifying proper transpilation of strings with reserved keywords
export default function StringKeywordsTest() {
    return <div className="test-container">
        <h2 className="test-title">String Keywords Test</h2>
        
        {/* Test 1: className with multiple reserved words */}
        <p className="text-xs text-gray-500 mb-2">
            Select a theme for the application
        </p>
        
        {/* Test 2: Multiple space-separated classes */}
        <button className="px-3 py-1 bg-blue-600 text-white rounded">
            Click Button
        </button>
        
        {/* Test 3: String containing JSX-like syntax */}
        <div className="jsx-string-test">
            This string contains JSX-like text: {"<div>test</div>"}
        </div>
        
        {/* Test 4: Complex className with reserved keywords */}
        <div className="flex gap-2 items-center justify-between p-4">
            <span className="font-bold text-lg">Reserved Keywords OK</span>
        </div>
        
        {/* Test 5: Nested elements with multiple classNames */}
        <section className="mt-4 space-y-2">
            <div className="bg-gray-100 p-2 rounded">
                <p className="text-sm">Nested element with classes</p>
            </div>
            <div className="bg-blue-50 text-blue-800">
                <p className="font-medium">Another nested element</p>
            </div>
        </section>
    </div>;
}
