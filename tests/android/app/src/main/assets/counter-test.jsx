import React, { useState } from 'react';

const CounterTest = () => {
    const [count, setCount] = useState(0);

    return (
        <div className="container primary-bg">
            <h1 className="heading">Counter App</h1>
            <p className="text-lg">Count is: {String(count)}</p>
            <button
                onClick={() => {
                    console.log('Click! Old count:', count);
                    setCount(count + 1);
                    console.log('Click! New count:', count + 1);
                }}
                className="btn btn-primary"
            >
                Increment: {String(count)}
            </button>
        </div>
    );
};

export default CounterTest;
