# Med-RAG: Medical Insurance Claims Processing System

A full-stack Retrieval-Augmented Generation (RAG) system for processing medical insurance claims using AI-powered document analysis.

## 🚀 Features

- **AI-Powered Claims Processing**: Uses Gemini API to analyze claims against policy documents
- **Document Retrieval**: ChromaDB vector store for efficient document similarity search
- **Structured Responses**: Returns JSON responses with decision, amount, and justification
- **Modern UI**: Clean, responsive React frontend with Tailwind CSS
- **Real-time Processing**: Instant analysis of medical claims queries

## 🏗️ Architecture

```
Frontend (React + Vite) → Backend (Node.js + Express) → LangChain + ChromaDB → Gemini API
```

## 📁 Project Structure

```
rag-document-processor/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── main.jsx       # React entry point
│   │   └── index.css      # Tailwind CSS styles
│   ├── package.json       # Frontend dependencies
│   └── vite.config.js     # Vite configuration
├── server/                 # Node.js backend
│   ├── documents/         # Policy documents
│   │   ├── policy_doc_1.txt
│   │   ├── policy_doc_2.txt
│   │   ├── policy_doc_3.txt
│   │   └── policy_doc_4.txt
│   ├── index.js           # Express server + RAG pipeline
│   ├── package.json       # Backend dependencies
│   └── .env               # Environment variables
└── README.md              # This file
```

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls
- **Lucide React** - Beautiful icons
- **React Loader Spinner** - Loading animations

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **LangChain.js** - LLM application framework
- **ChromaDB** - Vector database for embeddings
- **HuggingFace Embeddings** - Text embedding model
- **Axios** - HTTP client for Gemini API calls

### AI Services
- **Gemini API** - Google's latest LLM for claims analysis
- **HuggingFace** - Free text embeddings (alternative to paid services)

## 📋 Prerequisites

- Node.js 18+ and npm
- Gemini API key from Google AI Studio
- (Optional) HuggingFace API key for better embeddings

## 🚀 Setup Instructions

### 1. Clone and Navigate
```bash
cd rag-document-processor
```

### 2. Backend Setup
```bash
cd server

# Install dependencies
npm install

# Set up environment variables
# Edit .env file and add your Gemini API key:
# GEMINI_API_KEY="your_actual_api_key_here"

# Optional: Add HuggingFace API key for better embeddings
# HUGGINGFACE_API_KEY="your_hf_api_key_here"
```

### 3. Frontend Setup
```bash
cd ../client

# Install dependencies
npm install
```

### 4. Start the Application

#### Terminal 1 - Backend
```bash
cd server
npm start
```
The server will start on port 3001 and initialize the RAG pipeline.

#### Terminal 2 - Frontend
```bash
cd client
npm run dev
```
The frontend will start on port 5173.

### 5. Access the Application
Open your browser and navigate to: `http://localhost:5173`

## 🔑 API Configuration

### Gemini API Setup
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Add it to `server/.env`:
   ```
   GEMINI_API_KEY="your_api_key_here"
   ```

### HuggingFace API (Optional)
1. Visit [HuggingFace](https://huggingface.co/settings/tokens)
2. Create a new access token
3. Add it to `server/.env`:
   ```
   HUGGINGFACE_API_KEY="your_token_here"
   ```

## 📖 Usage

### 1. Submit a Query
- Type your medical claim question in the left panel
- Use the example queries for inspiration
- Click "Process Query" or press Enter

### 2. View Results
- The right panel displays AI analysis results
- See the decision (approved/rejected)
- View the approved amount (if applicable)
- Read the detailed justification
- Expand "View Raw AI Response" for technical details

### 3. Example Queries
- **Age-based coverage**: "I'm 25 years old and need hip surgery. I live in Delhi. What's covered?"
- **Policy timing**: "My 3-month-old child needs medical treatment. Is this covered?"
- **Location-based payouts**: "I need surgery in a small town. What's the maximum payout?"
- **Age restrictions**: "I'm 65 years old. Are my medical procedures covered?"

## 🔍 How It Works

1. **Document Loading**: Server loads policy documents from the `documents/` folder
2. **Text Processing**: Documents are split into chunks using LangChain's text splitter
3. **Embedding Generation**: Text chunks are converted to vector embeddings
4. **Vector Storage**: Embeddings are stored in ChromaDB for similarity search
5. **Query Processing**: User queries are converted to embeddings and compared
6. **Document Retrieval**: Top 5 most relevant document chunks are retrieved
7. **AI Analysis**: Gemini API analyzes the query against retrieved context
8. **Response Generation**: Structured JSON response with decision and justification

## 📊 Policy Documents

The system includes 4 sample policy documents:

- **Clause 10.1**: 6-month waiting period for joint surgeries
- **Clause 12.5**: Age coverage (18-60 years)
- **Clause 15.3**: Location-based payout limits (Tier-1 cities: $5,000, others: $3,000)
- **Clause 11.2**: Minimum age requirement (6 months)

## 🧪 Testing

### Test Queries
1. **Approved Claim**: "I'm 30 years old, need knee surgery, live in Mumbai, and my policy is 1 year old"
2. **Rejected Claim**: "I'm 17 years old and need medical treatment"
3. **Rejected Claim**: "I need hip surgery but my policy is only 3 months old"

### Health Check
Test the backend health: `GET http://localhost:3001/health`

## 🐛 Troubleshooting

### Common Issues

1. **"RAG pipeline not yet initialized"**
   - Wait for server startup to complete
   - Check server console for initialization errors

2. **"Unable to connect to server"**
   - Ensure backend is running on port 3001
   - Check if port 3001 is available

3. **"Invalid request to Gemini API"**
   - Verify your API key in `.env`
   - Check API key permissions and quotas

4. **Embedding errors**
   - Consider adding a HuggingFace API key
   - Check internet connectivity for model downloads

### Debug Mode
Enable detailed logging by checking the server console output.

## 🔧 Development

### Adding New Documents
1. Add `.txt` files to `server/documents/`
2. Restart the server
3. Documents are automatically loaded and indexed

### Modifying the RAG Pipeline
- Edit `server/index.js` to change chunk sizes, similarity search parameters
- Modify the Gemini prompt in the `/process-query` endpoint

### Customizing the Frontend
- Edit `client/src/App.jsx` for UI changes
- Modify `client/src/index.css` for styling updates

## 📈 Performance

- **Document Loading**: ~2-3 seconds on startup
- **Query Processing**: ~3-5 seconds (depends on Gemini API response time)
- **Vector Search**: Sub-second similarity search
- **Memory Usage**: ~100-200MB for in-memory ChromaDB

## 🔒 Security Notes

- API keys are stored in `.env` files (never commit these)
- CORS is configured for local development only
- Consider adding authentication for production use

## 🚀 Production Deployment

For production deployment:

1. **Environment Variables**: Use proper secret management
2. **Database**: Replace in-memory ChromaDB with persistent storage
3. **Authentication**: Add user authentication and authorization
4. **Rate Limiting**: Implement API rate limiting
5. **Monitoring**: Add logging and monitoring
6. **HTTPS**: Enable HTTPS for production

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review server console logs
- Ensure all dependencies are properly installed

---

**Built with ❤️ using React, Node.js, LangChain, and Gemini API**
