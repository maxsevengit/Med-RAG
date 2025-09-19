#!/bin/bash

echo "🚀 Starting Med-RAG System..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"
echo ""

# Check if .env file exists and has API key
if [ ! -f "server/.env" ]; then
    echo "❌ server/.env file not found. Please create it with your Gemini API key."
    echo "Example:"
    echo "GEMINI_API_KEY=\"your_api_key_here\""
    exit 1
fi

# Check if API key is set
if ! grep -q "GEMINI_API_KEY=" "server/.env" || grep -q 'GEMINI_API_KEY=""' "server/.env"; then
    echo "❌ Please set your Gemini API key in server/.env file"
    echo "Get your API key from: https://aistudio.google.com/"
    exit 1
fi

echo "✅ Environment variables configured"
echo ""

# Install dependencies if node_modules doesn't exist
echo "📦 Installing dependencies..."

if [ ! -d "server/node_modules" ]; then
    echo "Installing server dependencies..."
    cd server && npm install && cd ..
fi

if [ ! -d "client/node_modules" ]; then
    echo "Installing client dependencies..."
    cd client && npm install && cd ..
fi

echo "✅ Dependencies installed"
echo ""

echo "🌐 Starting the application..."
echo ""

# Start backend in background
echo "🔧 Starting backend server on port 3001..."
cd server
npm start &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to initialize
sleep 5

# Start frontend
echo "🎨 Starting frontend on port 5173..."
cd client
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 Med-RAG system is starting up!"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:3001"
echo "🏥 Health:   http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
