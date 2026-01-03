// Lazy loaded data for test-hook.jsx
const data = {
    source: 'lazy-data.js',
    timestamp: new Date().toISOString(),
    values: [10, 20, 30, 40, 50],
    message: 'This data was lazily loaded!'
};

module.exports = {
    testData: data,
    default: data
};
