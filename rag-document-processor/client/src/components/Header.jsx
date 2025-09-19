import React from 'react';
import { Activity, Shield, Brain } from 'lucide-react';

const Header = ({ accuracy, avgResponseTime }) => {
  return (
    <header className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white shadow-2xl">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                <Activity className="w-2 h-2 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                Med-RAG
              </h1>
              <p className="text-blue-100 text-sm font-medium">
                AI-Powered Medical Insurance Claims Processing
              </p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
              <Brain className="w-4 h-4 text-blue-200" />
              <span className="text-sm text-blue-100">AI-Powered Analysis</span>
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-200 font-medium">System Online</span>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm font-medium text-white">Claims Processed</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">1,247+</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-sm font-medium text-white">Accuracy Rate</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{accuracy}%</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-sm font-medium text-white">Avg Response Time</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{avgResponseTime > 0 ? `${avgResponseTime}s` : '-'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
