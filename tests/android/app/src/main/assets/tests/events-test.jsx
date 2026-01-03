import React, { useState } from 'react';

export default function EventsTest() {
    const [clicks, setClicks] = useState(0);
    const [lastEvent, setLastEvent] = useState('None');

    const handleClick = () => {
        setClicks(clicks + 1);
        setLastEvent('Button Click');
        console.log('[Events] Button clicked, total:', clicks + 1);
    };

    return (
        <div className="test-section">
            <h2>Event Handling Test</h2>
            <p>Tests: onClick events, event handlers, act/android integration</p>

            <div className="test-case">
                <h3>Click Count: {clicks}</h3>
                <h3>Last Event: {lastEvent}</h3>

                <button onClick={handleClick} className="btn btn-primary">
                    Click Me!
                </button>

                <button
                    onClick={() => {
                        setClicks(0);
                        setLastEvent('Reset');
                        console.log('[Events] Reset clicked');
                    }}
                    className="btn btn-secondary"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
