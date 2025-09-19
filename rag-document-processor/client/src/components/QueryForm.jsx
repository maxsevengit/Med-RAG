import React, { useState } from 'react';
import { Send, Sparkles, MessageSquare, Zap } from 'lucide-react';
import { TailSpin } from 'react-loader-spinner';

const QueryForm = ({ onSubmit, loading, error }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    onSubmit(query.trim());
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const sampleQueries = [
    "What are the main terms and conditions in this document?",
    "What are the key benefits or coverage mentioned?",
    "Are there any exclusions or limitations I should know about?"
  ];

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Ask Questions About Your Documents</h2>
            <p className="text-sm text-gray-600">Ask questions about your uploaded documents for AI-powered analysis</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label htmlFor="query" className="block text-sm font-semibold text-gray-700 mb-2">
              Your Question
            </label>
            <div className="relative">
              <textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask any question about your uploaded documents..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 resize-none h-32 text-gray-700 placeholder-gray-400"
                disabled={loading}
              />
              <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">AI-Powered</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <>
                <TailSpin height="20" width="20" color="white" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Analyze Documents</span>
                <Zap className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Try these sample queries:</span>
          </h3>
          <div className="space-y-2">
            {sampleQueries.map((sample, index) => (
              <button
                key={index}
                onClick={() => setQuery(sample)}
                disabled={loading}
                className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all duration-200 text-sm text-gray-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{sample}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryForm;
