export default function MapTest() {
    const peers = [{host: 'a'}];
    return (
        <div>
            {peers.map(peer => (
                <Item key={peer.host} host={peer.host} />
            ))}
        </div>
    );
}
