import React, { useState } from 'react';

const SimpleTest = () => {
    const [count, setCount] = useState(0);

    const handleClick = () => {
        console.log('Button clicked! Count before:', count);
        setCount(count + 1);
        console.log('Button clicked! Count after:', count + 1);
    };

    return (
        <div className="container primary-bg">
            <h1>Simple Counter Test</h1>
            <p className="text-lg">Current count: {count}</p>
            <button onClick={handleClick} className="btn btn-primary">
                Click Me ({count})
            </button>
        </div>
    );
};

export default SimpleTest;
