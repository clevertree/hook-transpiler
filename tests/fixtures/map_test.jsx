export default function MapTest({ peers }) {
    return (
        <div>
            {peers.map(p => (
                <Item key={p.id} peer={p} />
            ))}
        </div>
    )
}

function Item({ peer }) {
    return <div>{peer.name}</div>
}
