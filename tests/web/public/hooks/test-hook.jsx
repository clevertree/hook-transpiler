import { useEffect, useMemo, useState } from "react";
import ListItem from "./components/list-item.jsx";
import sample from "./sample-data.js";
import { namespaceValue as nsValue, tags as nsTags } from "./ns-helper.js";

const { items: seededItems, meta, mapNote } = sample;

export default function TestHook(context = {}) {
    // console.log("[TestHook] Component function called");
    const { env: { theme = "light" } = {} } = context;
    const [items, setItems] = useState(seededItems);
    const [{ lazyMessage, nestedMessage }, setLazyState] = useState({ lazyMessage: null, nestedMessage: null });

    useEffect(() => {
        let active = true;

        console.log("[TestHook] Starting lazy imports...");
        Promise.all([
            import("./lazy-data.js"),
            import("/hooks/lazy-data.js?x=1#frag"),
            import("./nested/data.js"),
            import("./dir/index.js")
        ])
            .then(([rel, abs, nested, dirIndex]) => {
                // console.log("[TestHook] Lazy imports resolved:", { rel: rel.default, abs: abs.default, nested: nested.default, dirIndex: dirIndex.default });
                if (!active) return;
                setLazyState({
                    lazyMessage: `${rel.default} + ${abs.default}`,
                    nestedMessage: `${nested.default} + ${dirIndex.default}`
                });
            })
            .catch((err) => {
                console.error("[TestHook] Lazy import failed:", err);
                if (!active) return;
                setLazyState({ lazyMessage: `Lazy load failed: ${err.message}`, nestedMessage: null });
            });

        return () => {
            active = false;
        };
    }, []);

    const tagsById = useMemo(() => new Map(items.map(({ id, tags = [] }) => [id, tags])), [items]);
    const [primaryTag, ...otherTags] = nsTags;

    const addItem = () => {
        const nextId = items.length + 1;
        setItems([...items, { id: nextId, name: `Item ${nextId}`, tags: [primaryTag, ...otherTags].slice(0, 2) }]);
    };

    return <div className="p-4 bg-white text-gray-800 rounded shadow-lg">
        <h1 className="text-2xl font-bold mb-1">{meta.title}</h1>
        <p className="text-sm text-gray-500 mb-4">{meta.subtitle}</p>

        <div className="mt-2">
            <p className="text-xs text-gray-500 mb-2">Select a theme for the application</p>
            <button className="px-3 py-1 bg-blue-600 text-white rounded">Test Button with Classes</button>
        </div>

        <div className="space-y-2">
            {items.map((item) => (
                <ListItem key={item.id} item={item} tags={tagsById.get(item.id)} />
            ))}
        </div>

        <div className="mt-4 flex gap-2">
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={addItem}>Add item</button>
            <span className="text-xs text-gray-600">{mapNote}</span>
        </div>

        <div className="mt-4 p-2 bg-blue-50 text-blue-800 rounded">
            <p>Lazy Data: {lazyMessage || "Loading..."}</p>
            <p>Nested: {nestedMessage || "Loading nested..."}</p>
        </div>

        <div className="mt-4 p-2 bg-green-50 text-green-800 rounded">
            <p>Namespace Value: {nsValue}</p>
            <p>Primary tag: {primaryTag}</p>
            <p>Theme from context: {theme}</p>
        </div>

        <div className="mt-4 text-sm text-gray-500">
            <p>This string contains JSX-like text: {"<div>test</div>"}</p>
        </div>

        <div className="mt-4 p-2 bg-purple-50 text-purple-800 rounded">
            <h3 className="font-semibold mb-2">Reserved Keywords in strings Test</h3>
            <p>
                This paragraph has reserved keywords like interface await default import export but should still render correctly.
            </p>
        </div>
    </div >;
}
