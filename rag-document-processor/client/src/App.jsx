import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Send, FileText, Upload, Trash2, Eye } from 'lucide-react';
import HistoryItem from './components/HistoryItem';
import { TailSpin } from 'react-loader-spinner';

function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [queryHistory, setQueryHistory] = useState([]);

  const loadQueryHistory = async () => {
    try {
      const response = await axios.get('http://localhost:3001/query-history');
      setQueryHistory(response.data.reverse()); // Show newest first
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  };

  const handleProcessQuery = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError('');
    setResponse(null);

    try {
      const result = await axios.post('http://localhost:3001/process-query', {
        query: query.trim()
      });

      setResponse(result.data);
      await loadQueryHistory(); // Refresh history
    } catch (err) {
      console.error('Error processing query:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.code === 'ERR_NETWORK_ERROR') {
        setError('Unable to connect to server. Please ensure the backend is running.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleProcessQuery();
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file type
        const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'message/rfc822'];
        const allowedExtensions = ['.pdf', '.txt', '.docx', '.eml'];
        const fileExtension = `.${file.name.split('.').pop()}`;

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
          throw new Error(`Unsupported file type: ${file.type || 'unknown'}. Please upload PDF, TXT, DOCX, or EML files only.`);
        }

        const formData = new FormData();
        formData.append('document', file);

        // Upload document to backend
        const uploadResponse = await axios.post('http://localhost:3001/upload-document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        });

        // Add to documents list
        setDocuments(prev => [...prev, {
          id: uploadResponse.data.id,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString()
        }]);

        setUploadProgress((i + 1) * (100 / files.length));
      }

      // Refresh documents list
      await loadDocuments();
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await axios.get('http://localhost:3001/documents');
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      await axios.delete(`http://localhost:3001/documents/${documentId}`);
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError('Failed to delete document');
    }
  };

  const viewDocument = async (documentId) => {
    try {
      const response = await axios.get(`http://localhost:3001/documents/${documentId}/content`);
      // For now, just show the content in an alert. In a real app, you'd show this in a modal
      alert(`Document Content:\n\n${response.data.content}`);
    } catch (error) {
      console.error('Failed to view document:', error);
      setError('Failed to load document content');
    }
  };

  // Load documents and query history on component mount
  useEffect(() => {
    loadDocuments();
    loadQueryHistory();
  }, []);

  const getDecisionIcon = (decision) => {
    if (decision === 'approved') {
      return <CheckCircle className="w-8 h-8 text-green-500" />;
    } else if (decision === 'rejected') {
      return <XCircle className="w-8 h-8 text-red-500" />;
    }
    return null;
  };

  const getDecisionColor = (decision) => {
    if (decision === 'approved') {
      return 'text-green-600';
    } else if (decision === 'rejected') {
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getDecisionBgColor = (decision) => {
    if (decision === 'approved') {
      return 'bg-green-50 border-green-200';
    } else if (decision === 'rejected') {
      return 'bg-red-50 border-red-200';
    }
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">Med-RAG</h1>
          </div>
          <p className="text-lg text-gray-600">
            Medical Insurance Claims Processing with AI-Powered Document Analysis
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Input */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Document Management & Query
            </h2>
            
            {/* Document Upload Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Upload Documents</h3>
              
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.docx,.eml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <TailSpin color="white" height={20} width={20} />
                      Uploading... {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Choose PDF/Document Files
                    </>
                  )}
                </button>
                
                {uploadProgress > 0 && uploading && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>

            {/* Documents List */}
            {documents.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Uploaded Documents ({documents.length})</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          {doc.type} • {(doc.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => viewDocument(doc.id)}
                          className="p-1 text-blue-600 hover:text-blue-800"
                          title="View content"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
                  Describe your medical claim or question:
                </label>
                <textarea
                  id="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., I need knee surgery and I'm 45 years old. I live in Mumbai and my policy is 8 months old. What's my coverage?"
                  className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleProcessQuery}
                disabled={loading || !query.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <TailSpin color="white" height={20} width={20} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Process Query
                  </>
                )}
              </button>
            </div>

            {/* Query History */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Query History:</h3>
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {queryHistory.length > 0 ? (
                  queryHistory.map((item, index) => (
                    <HistoryItem
                      key={index}
                      item={item}
                      onQuerySelect={setQuery}
                    />
                  ))
                ) : (
                  <p className="p-3 text-sm text-gray-500 italic">No recent queries.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              AI Analysis Results
            </h2>

            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <TailSpin color="#4f46e5" height={60} width={60} />
                <p className="mt-4 text-gray-600">Analyzing your query against policy documents...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="text-red-800 font-medium">Error</span>
                </div>
                <p className="text-red-700 mt-2">{error}</p>
              </div>
            )}

            {response && !loading && (
              <div className={`border rounded-lg p-6 ${getDecisionBgColor(response.Decision)}`}>
                {/* Decision Header */}
                <div className="flex items-center gap-3 mb-4">
                  {getDecisionIcon(response.Decision)}
                  <div>
                    <h3 className={`text-xl font-bold ${getDecisionColor(response.Decision)}`}>
                      {response.Decision === 'approved' ? 'Claim Approved' : 'Claim Rejected'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      AI Analysis Complete
                    </p>
                  </div>
                </div>

                {/* Amount */}
                {response.Amount !== null && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Approved Amount:</h4>
                    <p className="text-2xl font-bold text-green-600">
                      ${response.Amount.toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Justification */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Justification:</h4>
                  <p className="text-gray-800 leading-relaxed">
                    {response.Justification}
                  </p>
                </div>

                {/* Raw Response */}
                <details className="mt-6">
                  <summary className="text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-800">
                    View Raw AI Response
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {!loading && !error && !response && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Submit a query to see AI analysis results</p>
                <p className="text-sm">The system will analyze your query against policy documents and provide a decision</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 text-sm">
          <p>Powered by Gemini API, LangChain, and ChromaDB</p>
          <p className="mt-1">Medical Insurance Claims Processing System</p>
        </div>
      </div>
    </div>
  );
}

export default App;
