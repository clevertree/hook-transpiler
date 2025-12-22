use relay_hook_transpiler::transpile_jsx_simple;

#[test]
fn test_home_jsx() {
    let src = r#"export default function Home() {
    const appVersion = (globalThis.__appVersion) || '1.0.0';

    const peers = [
        { host: 'https://node-dfw1.relaynet.online', note: 'Default peer (DFW1)' },
        { host: 'https://node-dfw2.relaynet.online', note: 'Default peer (DFW2)' },
        { host: 'localhost:8080', note: 'Local dev peer' }
    ];

    return <div className="p-4 bg-gray-50" width="match_parent" height="match_parent">
        <div className="bg-blue-500 p-4 mb-4" width="match_parent" height="wrap_content">
            <span className="text-white text-xl font-bold" width="wrap_content" height="wrap_content">Relay Peers</span>
        </div>

        <div className="bg-white p-4 rounded shadow mb-4" width="match_parent" height="wrap_content">
            <span className="text-gray-800" width="wrap_content" height="wrap_content">Manage your Relay peers. This screen is simplified to match the working settings view.</span>
        </div>

        <div className="bg-white p-4 rounded border" width="match_parent" height="wrap_content">
            <div className="mb-2" width="match_parent" height="wrap_content">
                <span className="text-gray-800 font-semibold" width="wrap_content" height="wrap_content">Default peers</span>
            </div>
            {peers.map(peer => (
                <div key={peer.host} className="p-3 mb-2 rounded border" width="match_parent" height="wrap_content">
                    <span className="font-semibold" width="wrap_content" height="wrap_content">{peer.host}</span>
                    <span className="text-gray-600" width="wrap_content" height="wrap_content">{peer.note}</span>
                    <span className="text-xs mt-1 px-2 py-1 rounded bg-gray-100 text-gray-700" width="wrap_content" height="wrap_content">Status: Not probed</span>
                </div>
            ))}
        </div>

        <div className="absolute bottom-0 right-0 p-2 bg-gray-800 bg-opacity-75 rounded-tl" width="wrap_content" height="wrap_content">
            <span className="text-white text-xs" width="wrap_content" height="wrap_content">v{appVersion}</span>
        </div>
    </div>;
}
"#;
    let out = transpile_jsx_simple(src).expect("Should transpile home.jsx");
    println!("{}", out);
}
