import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Trash2, Eye, Download, Plus, FolderOpen } from 'lucide-react';
import axios from 'axios';

const DocumentManager = () => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await axios.get('http://localhost:3001/documents');
      setDocuments(response.data);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Allow PDF, text, docx, and eml files as supported by backend
        const isPdf = file.type.includes('pdf');
        const isText = file.type.includes('text');
        const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const isEml = file.type === 'message/rfc822' || file.name.toLowerCase().endsWith('.eml');
        
        if (!isPdf && !isText && !isDocx && !isEml) {
          throw new Error(`Unsupported file type: ${file.type}. Please upload PDF, TXT, DOCX, or EML files only.`);
        }

        const formData = new FormData();
        formData.append('document', file);

        const uploadResponse = await axios.post('http://localhost:3001/upload-document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        });

        setDocuments(prev => [...prev, {
          id: uploadResponse.data.id,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString()
        }]);

        setUploadProgress((i + 1) * (100 / files.length));
      }

      await loadDocuments();
      
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to upload document';
      setError(errorMessage);
      
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      const response = await axios.delete(`http://localhost:3001/documents/${documentId}`);
      if (response.data.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        setError(''); // Clear any previous errors
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete document';
      setError(errorMessage);
      
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleFocusDocument = async (documentId) => {
    try {
      await axios.post('http://localhost:3001/retrieval-settings', {
        includeSystemDocuments: false,
        allowedDocIds: [String(documentId)]
      });
      alert('Focusing retrieval on the selected document only.');
    } catch (error) {
      console.error('Error focusing document:', error);
      setError('Failed to update retrieval settings');
    }
  };

  const handleUseAllDocuments = async () => {
    try {
      await axios.post('http://localhost:3001/retrieval-settings', {
        includeSystemDocuments: true,
        allowedDocIds: null
      });
      alert('Retrieval reset to use all documents.');
    } catch (error) {
      console.error('Error resetting retrieval:', error);
      setError('Failed to reset retrieval settings');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('text')) return '📝';
    if (type.includes('wordprocessingml') || type.includes('docx')) return '📘';
    if (type.includes('rfc822') || type.includes('eml')) return '📧';
    return '📋';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Document Manager</h2>
              <p className="text-sm text-gray-600">Upload and manage policy documents</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span>{documents.length} documents</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Upload Section */}
        <div className="mb-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.txt,.docx,.eml"
            multiple
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] border-2 border-dashed border-emerald-300 hover:border-emerald-400"
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Uploading... {uploadProgress}%</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <Upload className="w-5 h-5" />
                <span>Upload Policy Documents</span>
              </>
            )}
          </button>

          {uploading && (
            <div className="mt-3">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Retrieval Controls */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={handleUseAllDocuments}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 border"
          >
            Use all documents
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Documents List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            <span>Uploaded Documents ({documents.length})</span>
          </h3>

          {documents.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No documents uploaded yet</p>
              <p className="text-gray-400 text-sm mt-1">Upload policy documents to get started</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {documents.map((doc) => (
                <div key={doc.id} className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl p-4 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="text-2xl">{getFileIcon(doc.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-800 truncate">{doc.name}</h4>
                          {doc.isSystemDocument && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              System
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-200">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleFocusDocument(doc.id)}
                        className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors duration-200"
                        title="Focus retrieval on this document"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={doc.isSystemDocument}
                        className={`p-2 rounded-lg transition-colors duration-200 ${doc.isSystemDocument ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:bg-red-100'}`}
                        title={doc.isSystemDocument ? 'System documents cannot be deleted' : 'Delete document'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;
