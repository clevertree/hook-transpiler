import React, { useState, useEffect } from 'react';

const ListItem = ({ item }) => (
  <div className="p-2 bg-gray-100 rounded mb-2">
    <span className="font-bold text-blue-500">{item.name}</span>
    {item.tags && (
      <div className="flex-row gap-2 mt-1">
        {item.tags.map(tag => (
          <span key={tag} className="text-sm bg-blue-500 text-white p-1 rounded">{tag}</span>
        ))}
      </div>
    )}
  </div>
);

export default function(context) {
  return <TestHook />;
}

function TestHook() {
  const [items, setItems] = useState([
    { id: 1, name: 'Android Item 1', tags: (['native', 'jni']) },
    { id: 2, name: 'Android Item 2', tags: (['ffi']) },
    { id: 3, name: 'Android Item 3' }
  ]);

  return (
    <div className="p-4 bg-white rounded shadow-lg">
      <span className="text-lg font-bold mb-4">Android UI Test</span>
      
      <div>
        {items.map(item => (
          <ListItem key={item.id} item={item} />
        ))}
      </div>

      <div className="mt-4 p-2 bg-gray-100 rounded">
        <span>This is rendered via Act/QuickJS</span>
      </div>
    </div>
  );
}
