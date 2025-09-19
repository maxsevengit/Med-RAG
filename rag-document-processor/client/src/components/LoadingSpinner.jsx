import React from 'react';
import { Brain, Zap } from 'lucide-react';

const LoadingSpinner = ({ message = "Processing your request..." }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        {/* Outer spinning ring */}
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        
        {/* Inner pulsing circle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
            <Brain className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-lg font-semibold text-gray-700 mb-2">{message}</p>
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
          <Zap className="w-4 h-4 text-blue-500" />
          <span>AI is analyzing your request</span>
        </div>
      </div>
      
      {/* Animated dots */}
      <div className="flex space-x-1 mt-4">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
