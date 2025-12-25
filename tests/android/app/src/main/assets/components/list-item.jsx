export default function ListItem({ item, tags }) {
    return (
        <div className="p-2 border-b border-gray-200">
            <span className="font-medium">{item.name}</span>
            {tags && tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                    {tags.map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 px-1 rounded">{tag}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
