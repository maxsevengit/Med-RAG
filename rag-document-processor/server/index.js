const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { simpleParser } = require('mailparser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, initDb } = require('./database');

let pineconeClient = null;
let pineconeIndex = null;
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

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // if there isn't any token

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---
app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);
  const id = uuidv4();

  const sql = 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)';
  db.run(sql, [id, email, password_hash], function (err) {
    if (err) {
      console.error('Signup error:', err.message);
      return res.status(500).json({ error: 'Email may already be in use.' });
    }
    res.status(201).json({ message: 'User created successfully' });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.get(sql, [email], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  });
});

// Global variables for RAG pipeline
let vectorStore;
let isRAGInitialized = false;

// Reusable components
let embedder = null;
let embeddings = null;
let textSplitter = null;
let indexedDocuments = []; // In-memory fallback for vector store

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
    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'message/rfc822'];
    const allowedExtensions = ['.pdf', '.txt', '.docx', '.eml'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        return cb(null, true);
    }
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
        pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        pineconeIndex = pineconeClient.index(process.env.PINECONE_INDEX);
        console.log('Pinecone client initialized');
      } catch (e) {
        console.warn('Failed to initialize Pinecone. Falling back to in-memory vector store.', e.message);
        pineconeClient = null;
        pineconeIndex = null;
      }
    }
    
    textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    // Initialize embeddings model
    try {
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('Embedding model loaded successfully');
    } catch (error) {
      console.log('Failed to load embedding model, using fallback.', error);
      embedder = null;
    }
    
    const embedQuery = async (text) => {
      if (typeof text !== 'string') text = String(text || '');
      if (embedder) {
        try {
          const output = await embedder(text, { pooling: 'mean', normalize: true });
          return Array.from(output.data);
        } catch (error) {
          console.log('Embedding failed, using fallback.', error);
        }
      }
      const hash = text.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) & 0xFFFFFFFF, 0);
      return new Array(384).fill(0).map((_, i) => Math.sin(hash + i) * 0.1);
    };

    embeddings = {
      embedQuery: embedQuery,
      embedDocuments: (documents) => Promise.all(documents.map(doc => embedQuery(doc))),
    };
    
    // Vector store abstraction
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
          const similarities = indexedDocuments
            .map(doc => ({ ...doc, similarity: cosineSimilarity(queryEmbedding, doc.embedding) }))
            .sort((a, b) => b.similarity - a.similarity);
          return similarities.slice(0, k).map(doc => ({ pageContent: doc.content, metadata: doc.metadata }));
        }
      };
    }
    
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
  if (ext === '.pdf' || mimetype.includes('pdf')) {
    return (await pdfParse(fs.readFileSync(filePath))).text || '';
  }
  if (ext === '.txt' || mimetype.includes('text')) {
    return fs.readFileSync(filePath, 'utf8');
  }
  if (ext === '.docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return (await mammoth.extractRawText({ path: filePath })).value || '';
  }
  if (ext === '.eml' || mimetype === 'message/rfc822') {
    const mail = await simpleParser(fs.createReadStream(filePath));
    return [mail.subject || '', mail.text || '', mail.html || ''].join('\n');
  }
  return fs.readFileSync(filePath, 'utf8');
}

// --- SECURED API ROUTES ---

// Documents API
app.get('/api/documents', authenticateToken, (req, res) => {
  const sql = 'SELECT id, name, type, size, uploaded_at as uploadedAt FROM documents WHERE user_id = ?';
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) {
      console.error('Error fetching documents:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve documents' });
    }
    res.json(rows);
  });
});

app.get('/api/documents/:id/content', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT * FROM documents WHERE id = ? AND user_id = ?';
  db.get(sql, [id, req.user.id], async (err, doc) => {
    if (err || !doc) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    try {
      const textContent = await extractTextFromFile(doc.path, doc.type);
      res.json({ content: textContent });
    } catch (e) {
      console.error('Failed to read document content:', e.message);
      res.status(500).json({ error: 'Failed to read document content' });
    }
  });
});

app.delete('/api/documents/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const findSql = 'SELECT path FROM documents WHERE id = ? AND user_id = ?';

  db.get(findSql, [id, req.user.id], (err, doc) => {
    if (err || !doc) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    const deleteSql = 'DELETE FROM documents WHERE id = ?';
    db.run(deleteSql, [id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete document from database' });
      }
      if (doc.path && fs.existsSync(doc.path)) {
        fs.unlinkSync(doc.path);
      }
      // TODO: Remove from vector index
      indexedDocuments = indexedDocuments.filter(d => d.metadata?.docId !== id);
      res.json({ success: true });
    });
  });
});

app.post('/api/documents/upload', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!isRAGInitialized) return res.status(503).json({ error: 'RAG pipeline not yet initialized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { originalname, mimetype, size, path: storedPath } = req.file;
    const textContent = await extractTextFromFile(storedPath, mimetype);
    const docId = uuidv4();
    const userId = req.user.id;
    const uploadedAt = new Date().toISOString();

    const sql = 'INSERT INTO documents (id, user_id, name, type, size, path, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.run(sql, [docId, userId, originalname, mimetype, size, storedPath, uploadedAt], async function (err) {
      if (err) {
        console.error('DB Error on upload:', err.message);
        return res.status(500).json({ error: 'Failed to save document metadata' });
      }
      try {
        const chunks = await textSplitter.splitDocuments([
          { pageContent: textContent, metadata: { source: storedPath, docId, userId } }
        ]);
        await vectorStore.addDocuments(chunks);
        res.status(201).json({ id: docId, name: originalname, type: mimetype, size, uploadedAt });
      } catch (indexError) {
        console.error('Indexing error on upload:', indexError.message);
        res.status(500).json({ error: 'Failed to index document' });
      }
    });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ error: error.message || 'Failed to upload document' });
  }
});

// Process query endpoint
app.post('/api/process-query', authenticateToken, async (req, res) => {
  try {
    if (!isRAGInitialized) return res.status(503).json({ error: 'RAG pipeline not yet initialized' });
    
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    
    console.log('Processing query:', query);

    const userDocsSql = 'SELECT id FROM documents WHERE user_id = ?';
    const userDocIds = await new Promise((resolve, reject) => {
      db.all(userDocsSql, [req.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.id));
      });
    });

    if (userDocIds.length === 0) {
      return res.json({
        Decision: "requires_more_info",
        Amount: null,
        Justification: "No documents have been uploaded yet. Please upload your policy documents first."
      });
    }

    const allSearchResults = await vectorStore.similaritySearch(query, 20);
    const searchResults = allSearchResults.filter(result => userDocIds.includes(result.metadata.docId)).slice(0, 5);
    const context = searchResults.map(doc => doc.pageContent).join('\\n\\n');
    
    if (!context.trim()) {
      return res.json({
        Decision: "requires_more_info",
        Amount: null,
        Justification: "Could not find relevant information in your documents to answer this question."
      });
    }
    
    console.log('Retrieved context from documents:', context.substring(0, 500) + '...');

    const ragPrompt = `You are a document analysis assistant. Analyze the following document context and answer the user's question based ONLY on this information.
    Document Context:
    ${context}
    User Question: ${query}
    Format your response as a JSON object with the structure: { "answer": "...", "decision": "approved/rejected/requires_more_info", "reasoning": "...", "relevant_clauses": ["..."], "limitations": "...", "confidence": "high/medium/low" }`;

    let finalResponse;
    try {
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { 
          contents: [{ parts: [{ text: ragPrompt }] }], 
          generationConfig: { response_mime_type: 'application/json', temperature: 0.1, max_output_tokens: 1024 } 
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
      finalResponse = JSON.parse(responseText);
      
      finalResponse.Justification = finalResponse.reasoning || 'Response generated based on policy documents';
      finalResponse.Decision = finalResponse.decision || 'requires_more_info';
      
      const moneyKeywords = ['amount', 'cost', 'price', 'fee', 'payout', 'coverage', 'limit'];
      if (moneyKeywords.some(k => query.toLowerCase().includes(k))) {
        const amountMatch = (finalResponse.answer + ' ' + finalResponse.reasoning).match(/\\$[\\d,]+|₹[\\d,]+|\\b\\d+[\\d,]*\\s*(?:dollars?|rupees?|USD|INR)\\b/i);
        finalResponse.Amount = amountMatch ? parseInt(amountMatch[0].replace(/[^\\d]/g, '')) || null : null;
      } else {
        finalResponse.Amount = null;
      }
      
    } catch (e) {
      console.warn('LLM response generation failed. Using fallback response.', e);
      finalResponse = {
        Decision: 'requires_more_info',
        Amount: null,
        Justification: 'Technical error occurred while analyzing policy documents.'
      };
    }
    
    const historyId = uuidv4();
    const historySql = 'INSERT INTO query_history (id, user_id, query, response, timestamp) VALUES (?, ?, ?, ?, ?)';
    db.run(historySql, [historyId, req.user.id, query, JSON.stringify(finalResponse), new Date().toISOString()], (err) => {
      if (err) console.error('Failed to save query history:', err.message);
    });
    
    res.json(finalResponse);
    
  } catch (error) {
    console.error('Error processing query:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Query History API
app.get('/api/query-history', authenticateToken, (req, res) => {
  const sql = 'SELECT * FROM query_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10';
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to retrieve query history' });
    }
    const history = rows.map(row => {
      try {
        return { ...row, response: JSON.parse(row.response) };
      } catch (e) {
        return { ...row, response: { Justification: 'Error: Could not parse response.'} };
      }
    });
    res.json(history);
  });
});

app.delete('/api/query-history/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM query_history WHERE id = ? AND user_id = ?';
  db.run(sql, [id, req.user.id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete history item' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'History item not found or access denied' });
    }
    res.json({ success: true });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', ragInitialized: isRAGInitialized });
});

// Start server
async function startServer() {
  try {
    initDb();
    await initializeRAG();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();