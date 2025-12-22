module.exports.default = function (context) {
    // Import styles and utilities
    const { theme, colors } = context || { theme: {}, colors: {} };

    // Destructure from nested object
    const { spacing = {} } = theme || {};
    const { primary = '#2196F3', secondary = '#FF9800', error = '#F44336' } = colors || {};

    // Array of items to map
    const items = [
        { id: 1, label: 'Dashboard', icon: '📊', color: primary },
        { id: 2, label: 'Settings', icon: '⚙️', color: secondary },
        { id: 3, label: 'Profile', icon: '👤', color: error }
    ];

    // Helper function for Tailwind classes
    const getContainerClasses = () => 'bg-white rounded-lg shadow-md p-4 m-2';
    const getHeaderClasses = () => 'text-2xl font-bold text-gray-800 mb-4';
    const getItemClasses = () => 'flex items-center p-3 mb-2 rounded border-l-4 hover:bg-gray-50';
    const getLabelClasses = () => 'ml-3 text-base text-gray-700';

    return (
        <div className={getContainerClasses()}>
            <h1 className={getHeaderClasses()}>Advanced Test Suite</h1>

            <section className="mb-6">
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Theme Colors</h2>
                <div className="flex gap-2">
                    <div
                        className="w-12 h-12 rounded"
                        style={{ backgroundColor: primary }}
                        title="Primary Color"
                    />
                    <div
                        className="w-12 h-12 rounded"
                        style={{ backgroundColor: secondary }}
                        title="Secondary Color"
                    />
                    <div
                        className="w-12 h-12 rounded"
                        style={{ backgroundColor: error }}
                        title="Error Color"
                    />
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Dynamic List</h2>
                <div>
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={getItemClasses()}
                            style={{ borderColor: item.color }}
                        >
                            <span style={{ fontSize: '1.5em' }}>{item.icon}</span>
                            <span className={getLabelClasses()}>{item.label}</span>
                            <span
                                className="ml-auto px-2 py-1 rounded text-white text-xs font-semibold"
                                style={{ backgroundColor: item.color }}
                            >
                                {item.id}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Spacing Demonstration</h2>
                <div className="space-y-4">
                    <div className="bg-blue-100 p-2 text-sm text-blue-900">
                        p-2 (small padding)
                    </div>
                    <div className="bg-green-100 p-4 text-sm text-green-900">
                        p-4 (medium padding)
                    </div>
                    <div className="bg-yellow-100 p-6 text-sm text-yellow-900">
                        p-6 (large padding)
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Typography</h2>
                <div className="space-y-2">
                    <p className="text-sm text-gray-500">Small text (text-sm)</p>
                    <p className="text-base text-gray-600">Base text (text-base)</p>
                    <p className="text-lg text-gray-700">Large text (text-lg)</p>
                    <p className="text-xl font-semibold text-gray-800">Extra large bold (text-xl font-semibold)</p>
                </div>
            </section>
        </div>
    );
}
