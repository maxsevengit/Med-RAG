import React from 'react';
import { CheckCircle2, XCircle, FileDown, MessageSquareWarning } from 'lucide-react';

const ResponseDisplay = ({ response }) => {
  if (!response) {
    return null; // Don't render anything if there's no response
  }

  // Handle both old and new response formats
  const isApproved = response.decision?.toLowerCase() === 'approved' || response.Decision?.toLowerCase() === 'approved';
  const decision = response.decision || response.Decision || 'requires_more_info';
  const amount = response.amount || response.Amount;
  const justification = response.justification || response.reasoning || response.Justification;
  const answer = response.answer;
  const relevantClauses = response.relevant_clauses || [];
  const limitations = response.limitations;
  const confidence = response.confidence;

  return (
    <div className="bg-white/50 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50 p-6 w-full">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center">
        {decision === 'approved' ? (
            <CheckCircle2 className="w-6 h-6 text-green-500 mr-3" />
        ) : decision === 'rejected' ? (
            <XCircle className="w-6 h-6 text-red-500 mr-3" />
        ) : (
            <MessageSquareWarning className="w-6 h-6 text-yellow-500 mr-3" />
        )}
        Policy Analysis Result
      </h3>
      <p className="text-sm text-gray-500 mt-1 mb-6">AI-powered decision based on policy analysis</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Decision Status */}
        <div>
          <label className="text-sm font-medium text-gray-600">Decision Status</label>
          <div className={`mt-2 flex items-center justify-center p-3 rounded-lg ${
            decision === 'approved' ? 'bg-green-100' : 
            decision === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'
          }`}>
            {decision === 'approved' ? (
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            ) : decision === 'rejected' ? (
              <XCircle className="w-7 h-7 text-red-600" />
            ) : (
              <MessageSquareWarning className="w-7 h-7 text-yellow-600" />
            )}
          </div>
          <p className="text-xs text-center mt-1 text-gray-600 capitalize">
            {decision.replace('_', ' ')}
          </p>
        </div>

        {/* Coverage Amount */}
        <div>
          <label className="text-sm font-medium text-gray-600">$ Coverage Amount</label>
          <div className="mt-2 flex items-center justify-center p-3 rounded-lg bg-blue-50 border border-blue-200/80">
            <p className="text-xl font-semibold text-blue-800">
              {amount !== null && amount !== undefined ? `$${amount.toLocaleString()}` : '$ N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* AI Analysis & Answer */}
      <div className="mt-6">
        <label className="text-sm font-medium text-gray-600">AI Analysis & Answer</label>
        <div className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-200/80 h-36 overflow-y-auto prose prose-sm max-w-none">
          {answer && (
            <div className="mb-3">
              <strong className="text-gray-800">Answer:</strong>
              <p className="leading-relaxed whitespace-pre-wrap mt-1">{answer}</p>
            </div>
          )}
          {justification && (
            <div className="mb-3">
              <strong className="text-gray-800">Reasoning:</strong>
              <p className="leading-relaxed whitespace-pre-wrap mt-1">{justification}</p>
            </div>
          )}
          {relevantClauses && relevantClauses.length > 0 && (
            <div className="mb-3">
              <strong className="text-gray-800">Relevant Policy Clauses:</strong>
              <ul className="mt-1 list-disc list-inside">
                {relevantClauses.map((clause, index) => (
                  <li key={index} className="text-gray-600">{clause}</li>
                ))}
              </ul>
            </div>
          )}
          {limitations && (
            <div className="mb-3">
              <strong className="text-gray-800">Limitations:</strong>
              <p className="leading-relaxed whitespace-pre-wrap mt-1 text-orange-600">{limitations}</p>
            </div>
          )}
          {confidence && (
            <div className="mt-3 pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-500">Confidence: </span>
              <span className={`text-xs font-medium ${
                confidence === 'high' ? 'text-green-600' : 
                confidence === 'medium' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {confidence.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Processing Info & Actions */}
      <div className="mt-6 pt-4 border-t border-gray-200/80">
        <div className="flex justify-between items-center text-xs text-gray-500 mb-4">
          <span>Processed at {new Date().toLocaleString()}</span>
          <span className="flex items-center text-green-600 font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            AI Analysis Complete
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center shadow-md">
            <FileDown className="w-4 h-4 mr-2" />
            Download Report
          </button>
          <button className="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-200 transition-all duration-300 flex items-center justify-center border border-gray-300">
            <MessageSquareWarning className="w-4 h-4 mr-2" />
            Request Review
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResponseDisplay;
