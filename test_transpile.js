const { transpile_jsx } = require('./pkg/relay_hook_transpiler.js');

const testCode = `
export function TestComponent() {
  const items = [1, 2, 3];
  return (
    <div>
      {items.map((item) => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}
`;

try {
  const result = transpile_jsx(testCode, 'test.jsx');
  console.log('=== TRANSPILED OUTPUT ===\n');
  console.log(result.code);
  if (result.error) {
    console.error('\n=== ERROR ===\n', result.error);
  }
} catch (err) {
  console.error('Error:', err);
}
