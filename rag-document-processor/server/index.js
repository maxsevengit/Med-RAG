const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { simpleParser } = require('mailparser');
let pineconeClient = null;
let pineconeIndex = null;
const { DirectoryLoader } = require('langchain/document_loaders/fs/directory');
const { TextLoader } = require('langchain/document_loaders/fs/text');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { pipeline } = require('@xenova/transformers');
const axios = require('axios');

// Helper function for cosine similarity
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Global variables for RAG pipeline
let vectorStore;
let isRAGInitialized = false;

// Index and registry for documents
let indexedDocuments = [];
let documentRegistry = [];
let nextDocumentId = 1;

// Store query history in memory
let queryHistory = [];

// Reusable components
let embedder = null;
let embeddings = null;
let textSplitter = null;
let retrievalSettings = {
  includeSystemDocuments: true,
  allowedDocIds: null, // null means no restriction; otherwise Set of allowed ids
};

// Simple heuristic parser as a fallback if LLM parsing fails
function basicHeuristicParse(query) {
  const numbers = query.match(/\d+/g) || [];
  let ageYears = null;
  let policyAgeMonths = null;
  if (numbers.length) {
    const first = parseInt(numbers[0], 10);
    if (query.toLowerCase().includes('year')) ageYears = first;
    if (query.toLowerCase().includes('month')) policyAgeMonths = first;
  }
  const locations = ['mumbai','delhi','bangalore','kolkata','chennai','pune'];
  const lower = query.toLowerCase();
  const location = locations.find(l => lower.includes(l)) || null;
  let procedure = null;
  if (lower.includes('knee')) procedure = 'knee surgery';
  else if (lower.includes('hip')) procedure = 'hip surgery';
  else if (lower.includes('surgery')) procedure = 'surgery';
  return { ageYears: Number.isFinite(ageYears) ? ageYears : null, ageMonths: null, procedure, location, policyAgeMonths };
}

// Deterministic rules per sample policy docs
function evaluatePolicyLogic(structured) {
  const ageYears = Number.isFinite(structured.ageYears) ? structured.ageYears : null;
  const policyAgeMonths = Number.isFinite(structured.policyAgeMonths) ? structured.policyAgeMonths : null;
  const location = (structured.location || '').toLowerCase();

  // Rules (from README sample):
  // - Waiting period for joint surgeries: 6 months
  // - Age coverage 18-60
  // - Location payout limits: Tier-1 cities $5,000, others $3,000
  // - Minimum age: 6 months

  // Minimum age requirement
  if (ageYears !== null && ageYears < 0.5) {
    return { Decision: 'rejected', Amount: null };
  }

  // Age coverage window
  if (ageYears !== null && (ageYears < 18 || ageYears > 60)) {
    return { Decision: 'rejected', Amount: null };
  }

  // Waiting period
  if (policyAgeMonths !== null && policyAgeMonths < 6) {
    return { Decision: 'rejected', Amount: null };
  }

  // If passes rules, approved with location-based cap
  const tier1 = ['mumbai', 'delhi', 'bangalore', 'kolkata', 'chennai'];
  const isTier1 = tier1.includes(location);
  const amount = isTier1 ? 5000 : 3000;
  return { Decision: 'approved', Amount: amount };
}

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to ensure uploads directory exists:', e);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filename = `${Date.now()}-${safeName}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const isPdf = file.mimetype.includes('pdf');
    const isText = file.mimetype.includes('text');
    const isDocx = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isEml = file.mimetype === 'message/rfc822' || file.originalname.toLowerCase().endsWith('.eml');
    if (isPdf || isText || isDocx || isEml) return cb(null, true);
    return cb(new Error('Unsupported file type. Please upload PDF, TXT, DOCX, or EML files only.'));
  }
});

// Initialize RAG pipeline
async function initializeRAG() {
  try {
    console.log('Initializing RAG pipeline...');
    // Optional Pinecone setup
    if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX && process.env.PINECONE_ENVIRONMENT) {
      try {
        const { Pinecone } = require('@pinecone-database/pinecone');
        pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY, environment: process.env.PINECONE_ENVIRONMENT });
        pineconeIndex = pineconeClient.index(process.env.PINECONE_INDEX);
        console.log('Pinecone client initialized');
      } catch (e) {
        console.warn('Failed to initialize Pinecone. Falling back to in-memory vector store.', e.message);
        pineconeClient = null;
        pineconeIndex = null;
      }
    }
    
    // Initialize text splitter for user-uploaded documents
    textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    console.log('RAG system initialized - ready for user-uploaded documents');
    
    // Initialize embeddings using Xenova transformers (free, runs locally)
    try {
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('Embedding model loaded successfully');
    } catch (error) {
      console.log('Failed to load embedding model, using fallback');
      embedder = null;
    }
    
    const embedQuery = async (text) => {
      // Ensure text is a string
      if (!text || typeof text !== 'string') {
        console.log('Invalid text for embedding:', text);
        text = String(text || '');
      }
      
      if (embedder) {
        try {
          const output = await embedder(text, { pooling: 'mean', normalize: true });
          return Array.from(output.data);
        } catch (error) {
          console.log('Embedding failed, using fallback');
        }
      }
      // Fallback: simple hash-based embedding
      const hash = text.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return new Array(384).fill(0).map((_, i) => 
        Math.sin(hash + i) * 0.1
      );
    };

    embeddings = {
      embedQuery: embedQuery,
      embedDocuments: async (documents) => {
        return Promise.all(documents.map(doc => embedQuery(doc.pageContent)));
      }
    };
    
    // Create a simple in-memory vector store
    indexedDocuments = [];

    // Vector store abstraction (initialize BEFORE indexing any documents)
    if (pineconeIndex) {
      vectorStore = {
        addDocuments: async (docsToAdd) => {
          const vectors = [];
          for (const d of docsToAdd) {
            const embedding = await embeddings.embedQuery(d.pageContent);
            vectors.push({ id: `${d.metadata.docId}-${vectors.length}-${Date.now()}`, values: embedding, metadata: { ...d.metadata, content: d.pageContent } });
          }
          if (vectors.length > 0) await pineconeIndex.upsert(vectors);
        },
        similaritySearch: async (query, k) => {
          const queryEmbedding = await embeddings.embedQuery(query);
          const result = await pineconeIndex.query({ vector: queryEmbedding, topK: k, includeMetadata: true });
          return (result.matches || []).map(m => ({ pageContent: m.metadata?.content || '', metadata: m.metadata || {} }));
        }
      };
    } else {
      vectorStore = {
        addDocuments: async (docsToAdd) => {
          for (const d of docsToAdd) {
            const embedding = await embeddings.embedQuery(d.pageContent);
            indexedDocuments.push({ content: d.pageContent, embedding, metadata: d.metadata });
          }
        },
        similaritySearch: async (query, k) => {
          const queryEmbedding = await embeddings.embedQuery(query);
          const similarities = indexedDocuments.map(doc => {
            const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
            return { ...doc, similarity };
          });
          similarities.sort((a, b) => b.similarity - a.similarity);
          return similarities.slice(0, k).map(doc => ({ pageContent: doc.content, metadata: doc.metadata }));
        }
      };
    }

    // Helper to add a whole document's text to the index with a document id
    const addDocumentTextToIndex = async (docId, fullText, metadata = {}) => {
      const chunks = await textSplitter.splitDocuments([
        { pageContent: fullText, metadata: { ...metadata, docId } }
      ]);
      await vectorStore.addDocuments(chunks);
    };

    // No system documents - only user-uploaded documents will be indexed

    // Also load previously uploaded files from uploads directory (persist across restarts)
    const uploadFiles = fs.readdirSync(uploadsDir, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => path.join(uploadsDir, d.name));

    for (const filePath of uploadFiles) {
      const ext = path.extname(filePath).toLowerCase();
      let textContent = '';
      try {
        if (ext === '.pdf') {
          const data = await pdfParse(fs.readFileSync(filePath));
          textContent = data.text || '';
        } else if (ext === '.txt') {
          textContent = fs.readFileSync(filePath, 'utf8');
        } else if (ext === '.docx') {
          const result = await mammoth.extractRawText({ path: filePath });
          textContent = result.value || '';
        } else if (ext === '.eml') {
          const mail = await simpleParser(fs.createReadStream(filePath));
          textContent = [mail.subject || '', mail.text || '', mail.html || ''].join('\n');
        } else {
          continue; // skip unsupported types on startup
        }
      } catch (e) {
        console.warn('Failed to parse uploaded file during startup:', filePath, e.message);
        continue;
      }

      const stats = fs.statSync(filePath);
      const docId = String(nextDocumentId++);
      documentRegistry.push({
        id: docId,
        name: path.basename(filePath),
        type: ext === '.pdf' ? 'application/pdf' : 'text/plain',
        size: stats.size || 0,
        uploadedAt: new Date(stats.mtimeMs).toISOString(),
        path: filePath,
        isSystemDocument: false,
        _cachedContent: textContent,
      });

      await addDocumentTextToIndex(docId, textContent, { source: filePath, isSystemDocument: false });
    }
    
    // Vector store ready
    
    console.log('RAG pipeline initialized successfully');
    isRAGInitialized = true;
    
  } catch (error) {
    console.error('Error initializing RAG pipeline:', error);
    throw error;
  }
}

// Helper to extract text from uploaded file
async function extractTextFromFile(filePath, mimetype) {
  const ext = path.extname(filePath).toLowerCase();
  if ((mimetype && mimetype.includes('pdf')) || ext === '.pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || '';
  }
  if ((mimetype && mimetype.includes('text')) || ext === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }
  if (mimetype === 'message/rfc822' || ext === '.eml') {
    const mail = await simpleParser(fs.createReadStream(filePath));
    return [mail.subject || '', mail.text || '', mail.html || ''].join('\n');
  }
  // Default: try utf8
  return fs.readFileSync(filePath, 'utf8');
}

// Documents API
app.get('/documents', (req, res) => {
  const list = documentRegistry.map(({ _cachedContent, ...rest }) => rest);
  res.json(list);
});

app.get('/documents/:id/content', async (req, res) => {
  const { id } = req.params;
  const doc = documentRegistry.find(d => d.id === id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  try {
    if (typeof doc._cachedContent === 'string' && doc._cachedContent.length > 0) {
      return res.json({ content: doc._cachedContent });
    }
    if (doc.path && fs.existsSync(doc.path)) {
      if ((doc.type || '').includes('pdf') || path.extname(doc.path).toLowerCase() === '.pdf') {
        const data = await pdfParse(fs.readFileSync(doc.path));
        return res.json({ content: data.text || '' });
      }
      const text = fs.readFileSync(doc.path, 'utf8');
      return res.json({ content: text });
    }
    return res.status(404).json({ error: 'Content not available' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read document content' });
  }
});

app.delete('/documents/:id', async (req, res) => {
  const { id } = req.params;
  const index = documentRegistry.findIndex(d => d.id === id);
  if (index === -1) return res.status(404).json({ error: 'Document not found' });
  const doc = documentRegistry[index];
  if (doc.isSystemDocument) {
    return res.status(400).json({ error: 'Cannot delete system policy document' });
  }
  try {
    // Remove file on disk
    if (doc.path && fs.existsSync(doc.path)) {
      fs.unlinkSync(doc.path);
    }
    // Remove from registry
    documentRegistry.splice(index, 1);
    // Remove from index
    indexedDocuments = indexedDocuments.filter(d => d.metadata?.docId !== id);
    // TODO: If Pinecone is enabled, you may also want to delete vectors by metadata filter.
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

app.post('/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!isRAGInitialized) {
      return res.status(503).json({ error: 'RAG pipeline not yet initialized' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, mimetype, size, path: storedPath } = req.file;
    let textContent = '';
    try {
      textContent = await extractTextFromFile(storedPath, mimetype);
    } catch (e) {
      return res.status(400).json({ error: 'Failed to parse file. Please upload a valid PDF, TXT, DOCX, or EML file.' });
    }

    const docId = String(nextDocumentId++);

    // Add to registry
    const registryEntry = {
      id: docId,
      name: originalname,
      type: mimetype,
      size: size || Buffer.byteLength(textContent || ''),
      uploadedAt: new Date().toISOString(),
      path: storedPath,
      isSystemDocument: false,
      _cachedContent: textContent,
    };
    documentRegistry.push(registryEntry);

    // Index the uploaded document
    const chunks = await textSplitter.splitDocuments([
      { pageContent: textContent, metadata: { source: storedPath, docId, isSystemDocument: false } }
    ]);
    await vectorStore.addDocuments(chunks);

    return res.json({ id: docId });
  } catch (error) {
    console.error('Upload failed:', error);
    if (error.message && error.message.includes('Unsupported file type')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Optional: ingest a document by URL (e.g., PDF blob URL)
app.post('/ingest-url', async (req, res) => {
  try {
    if (!isRAGInitialized) {
      return res.status(503).json({ error: 'RAG pipeline not yet initialized' });
    }
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'] || '';
    let ext = '.bin';
    if (contentType.includes('pdf')) ext = '.pdf';
    else if (contentType.includes('text')) ext = '.txt';
    else if (contentType.includes('wordprocessingml')) ext = '.docx';
    const tempPath = path.join(uploadsDir, `${Date.now()}-remote${ext}`);
    fs.writeFileSync(tempPath, Buffer.from(response.data));
    const textContent = await extractTextFromFile(tempPath, contentType);

    const docId = String(nextDocumentId++);
    const registryEntry = {
      id: docId,
      name: `remote${ext}`,
      type: contentType,
      size: Buffer.byteLength(textContent || ''),
      uploadedAt: new Date().toISOString(),
      path: tempPath,
      isSystemDocument: false,
      _cachedContent: textContent,
    };
    documentRegistry.push(registryEntry);

    const chunks = await textSplitter.splitDocuments([
      { pageContent: textContent, metadata: { source: tempPath, docId, isSystemDocument: false } }
    ]);
    await vectorStore.addDocuments(chunks);
    return res.json({ id: docId });
  } catch (e) {
    console.error('Failed to ingest URL:', e.message);
    return res.status(400).json({ error: 'Failed to ingest URL' });
  }
});

// Retrieval settings API
app.get('/retrieval-settings', (req, res) => {
  res.json(retrievalSettings);
});

app.post('/retrieval-settings', (req, res) => {
  const { includeSystemDocuments, allowedDocIds } = req.body || {};
  if (typeof includeSystemDocuments === 'boolean') {
    retrievalSettings.includeSystemDocuments = includeSystemDocuments;
  }
  if (Array.isArray(allowedDocIds)) {
    retrievalSettings.allowedDocIds = new Set(allowedDocIds.map(String));
  } else if (allowedDocIds === null) {
    retrievalSettings.allowedDocIds = null;
  }
  res.json({ success: true, settings: {
    includeSystemDocuments: retrievalSettings.includeSystemDocuments,
    allowedDocIds: retrievalSettings.allowedDocIds ? Array.from(retrievalSettings.allowedDocIds) : null,
  }});
});

// Process query endpoint
app.post('/process-query', async (req, res) => {
  try {
    if (!isRAGInitialized) {
      return res.status(503).json({ error: 'RAG pipeline not yet initialized' });
    }
    
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log('Processing query:', query);

    // 1) LLM Parser (with heuristic fallback)
    const parserPrompt = `Extract a structured JSON from the user query.
Fields: { ageYears: number|null, ageMonths: number|null, procedure: string|null, location: string|null, policyAgeMonths: number|null }
Return only JSON.`;
    let structured = basicHeuristicParse(query);
    try {
      const parseResp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: `${parserPrompt}\nQuery: ${query}` }] }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.0, max_output_tokens: 256 }
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const parsed = JSON.parse(parseResp.data.candidates[0].content.parts[0].text);
      structured = { ...structured, ...parsed };
    } catch (e) {
      console.warn('LLM parsing failed, using heuristic only');
    }

    // 2) Retrieve policy context from documents
    const searchResults = await vectorStore.similaritySearch(query, 5);
    const context = searchResults.map(doc => doc.pageContent).join('\n\n');
    
    // Check if no documents are available
    if (!context || context.trim().length === 0) {
      return res.json({
        answer: "No documents have been uploaded yet. Please upload your policy documents first to get answers to your questions.",
        decision: "requires_more_info",
        reasoning: "The system needs documents to analyze before it can answer questions.",
        relevant_clauses: [],
        limitations: "Upload policy documents to enable AI analysis.",
        confidence: "low",
        Decision: "requires_more_info",
        Amount: null,
        Justification: "No documents available for analysis. Please upload your policy documents first."
      });
    }
    
    console.log('Retrieved context from documents:', context.substring(0, 500) + '...');

    // 3) Generate response based on document content using LLM
    const moneyKeywords = ['amount', 'cost', 'price', 'fee', 'payout', 'coverage', 'limit', 'maximum', 'minimum', 'pay', 'paid', 'payment', 'claim amount', 'benefit amount', 'sum insured', 'deductible', 'premium'];
    const isMoneyQuestion = moneyKeywords.some(keyword => query.toLowerCase().includes(keyword));
    
    const ragPrompt = `You are a document analysis assistant. Analyze the following uploaded documents and answer the user's question based ONLY on the information provided in the documents.

Document Context:
${context}

User Question: ${query}

Please provide a comprehensive response that includes:
1. A clear answer to the user's question based on the document content
2. Specific references to relevant sections or clauses from the documents
3. Any limitations, exclusions, or conditions mentioned in the documents
4. If the information is not available in the provided documents, clearly state that

${isMoneyQuestion ? 'Since this is a question about amounts/money, please include specific monetary values if mentioned in the documents.' : 'Do not include monetary amounts unless specifically asked about them.'}

Format your response as a JSON object with the following structure:
{
  "answer": "Direct answer to the question",
  "decision": "approved/rejected/requires_more_info",
  "reasoning": "Detailed explanation based on document content",
  "relevant_clauses": ["List of relevant document sections or clauses"],
  "limitations": "Any limitations or exclusions mentioned",
  "confidence": "high/medium/low based on document clarity"
}`;

    let finalResponse;
    try {
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { 
          contents: [{ parts: [{ text: ragPrompt }] }], 
          generationConfig: { 
            response_mime_type: 'application/json', 
            temperature: 0.1, 
            max_output_tokens: 1024 
          } 
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
      console.log('Raw LLM response:', responseText);
      finalResponse = JSON.parse(responseText);
      console.log('Parsed response:', finalResponse);
      
    // Add legacy fields for compatibility
    finalResponse.Justification = finalResponse.reasoning || 'Response generated based on policy documents';
    
    // Check if the query is asking about money/amounts
    const moneyKeywords = ['amount', 'cost', 'price', 'fee', 'payout', 'coverage', 'limit', 'maximum', 'minimum', 'pay', 'paid', 'payment', 'claim amount', 'benefit amount', 'sum insured', 'deductible', 'premium'];
    const isMoneyQuestion = moneyKeywords.some(keyword => query.toLowerCase().includes(keyword));
    
    finalResponse.Decision = finalResponse.decision || 'requires_more_info';
    
    // Only provide amount for money-related questions
    if (isMoneyQuestion) {
      // Try to extract amount from the answer or reasoning
      const amountMatch = (finalResponse.answer + ' ' + finalResponse.reasoning).match(/\$[\d,]+|₹[\d,]+|\b\d+[\d,]*\s*(?:dollars?|rupees?|USD|INR)\b/i);
      if (amountMatch) {
        const amountStr = amountMatch[0].replace(/[$,₹]/g, '').replace(/[^\d]/g, '');
        finalResponse.Amount = parseInt(amountStr) || null;
      } else {
        finalResponse.Amount = null; // No specific amount found in document
      }
    } else {
      finalResponse.Amount = null; // Not a money question
    }
      
    } catch (e) {
      console.warn('LLM response generation failed. Using fallback response.');
      finalResponse = {
        answer: 'Unable to process query at this time. Please try again.',
        decision: 'requires_more_info',
        reasoning: 'Technical error occurred while analyzing policy documents.',
        relevant_clauses: [],
        limitations: 'Service temporarily unavailable',
        confidence: 'low',
        Decision: 'requires_more_info',
        Amount: null,
        Justification: 'Technical error occurred while analyzing policy documents.'
      };
    }
    
    // Store query in history
    queryHistory.push({
      query,
      timestamp: new Date().toISOString()
    });
    // Keep only last 50 queries
    if (queryHistory.length > 50) {
      queryHistory = queryHistory.slice(-50);
    }
    
    console.log('AI Response:', finalResponse);
    res.json(finalResponse);
    
  } catch (error) {
    console.error('Error processing query:', JSON.stringify(error.response?.data, null, 2) || error.message);
    
    if (error.response?.status === 400) {
      return res.status(400).json({ 
        error: 'Invalid request to Gemini API. Please check your API key and request format.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    ragInitialized: isRAGInitialized,
    timestamp: new Date().toISOString()
  });
});

// Get query history
app.get('/query-history', (req, res) => {
  res.json(queryHistory.slice(-10)); // Return last 10 queries
});

// Add query to history
app.post('/query-history', (req, res) => {
  const { query, timestamp } = req.body;
  if (query) {
    queryHistory.push({
      query,
      timestamp: timestamp || new Date().toISOString()
    });
    // Keep only last 50 queries
    if (queryHistory.length > 50) {
      queryHistory = queryHistory.slice(-50);
    }
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Query is required' });
  }
});

// Start server only after RAG pipeline is initialized
async function startServer() {
  try {
    await initializeRAG();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`RAG pipeline status: ${isRAGInitialized ? 'Initialized' : 'Failed'}`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
