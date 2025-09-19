# 🚀 Quick Start Guide - Med-RAG System

## ⚡ 5-Minute Setup

### 1. **Get Your API Key**
- Visit [Google AI Studio](https://aistudio.google.com/)
- Create a new API key
- Copy the key

### 2. **Configure Environment**
```bash
cd rag-document-processor/server
# Edit .env file and add your API key:
echo 'GEMINI_API_KEY="your_actual_api_key_here"' > .env
```

### 3. **Install Dependencies**
```bash
# From the project root
npm run install:all
```

### 4. **Start the System**
```bash
# Option 1: Use the startup script (recommended)
./start.sh

# Option 2: Manual start
npm run dev
```

### 5. **Access the Application**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health Check: http://localhost:3001/health

## 🧪 Test Immediately

Try this query:
```
I'm 30 years old, need knee surgery, live in Mumbai, and my policy is 1 year old. What's my coverage?
```

**Expected**: Approved with $5,000 payout

## 🚨 Troubleshooting

- **"RAG pipeline not yet initialized"** → Wait 5-10 seconds for startup
- **"Unable to connect to server"** → Check if backend is running on port 3001
- **"Invalid request to Gemini API"** → Verify your API key in `.env`

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed information
- Check [demo-queries.md](demo-queries.md) for more test cases
- Customize policy documents in `server/documents/`

---

**Need help?** Check the server console output for detailed error messages.
