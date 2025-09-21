import React, { useState } from 'react';
import { ChevronDown, CheckCircle, XCircle } from 'lucide-react';

const HistoryItem = ({ item, onQuerySelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getDecisionIcon = (decision) => {
    if (decision === 'approved') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (decision === 'rejected') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none"
      >
        <span className="flex-1 truncate" title={item.query}>{item.query}</span>
        <div className="flex items-center gap-2">
          {getDecisionIcon(item.response.Decision)}
          <ChevronDown
            className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {isOpen && (
        <div className="p-4 bg-gray-50 text-sm text-gray-700">
          <p className="font-semibold mb-2">AI Answer:</p>
          <p className="mb-3">{item.response.Justification}</p>
          <button
            onClick={() => onQuerySelect(item.query)}
            className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
          >
            Re-run this query
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoryItem;
