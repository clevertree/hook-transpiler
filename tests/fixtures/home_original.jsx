import React from 'react'

export async function probePeer(host) {
    return fetch(`https://${host}/health`).then(r => r.ok)
}

export default function Home() {
    const peers = [
        { host: 'node1.example.com', note: 'Primary' },
        { host: 'node2.example.com', note: 'Secondary' }
    ]

    return (
        <div className="home">
            <h1>Peers</h1>
            <ul>
                {peers.map(p => (
                    <li key={p.host}>
                        <span>{p.host}</span>
                        <span>{p.note}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
