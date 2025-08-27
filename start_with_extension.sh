#!/bin/bash

echo "🚀 Starting Complete Redis + Chrome Extension Setup"
echo "==================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if CSV file exists
if [ ! -f "(Clone)_SearchQuery_productid_level_metric_2025_07_17.csv" ]; then
    echo "❌ CSV file not found: (Clone)_SearchQuery_productid_level_metric_2025_07_17.csv"
    echo "Please place your CSV file in the current directory."
    exit 1
fi

# Check if Python dependencies are installed
if ! python3 -c "import flask, redis, pandas" 2>/dev/null; then
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
fi

echo "✅ Docker is running"
echo "✅ CSV file found"
echo "✅ Python dependencies available"

# Start Redis cluster
echo ""
echo "🔧 Starting Redis cluster..."
docker compose up -d

echo ""
echo "⏳ Waiting for Redis cluster to initialize..."
sleep 30

# Check if cluster is ready
echo "🔍 Checking cluster status..."
if docker exec redis-node-1 redis-cli --cluster check localhost:6379 > /dev/null 2>&1; then
    echo "✅ Redis cluster is healthy!"
else
    echo "⚠️  Cluster may still be initializing..."
fi

# Check data loading
echo ""
echo "📊 Checking data loading status..."
docker compose logs data-loader | tail -5

echo ""
echo "🌐 Starting API bridge server for Chrome extension..."
echo "📡 API will be available at http://localhost:5000"

# Start API server in background
python3 api_server.py &
API_PID=$!

echo ""
echo "🎉 Setup complete! Here's what's running:"
echo ""
echo "✅ Redis Cluster (6 nodes): Ports 7001-7006"
echo "✅ API Bridge Server: http://localhost:5000"
echo "✅ Data loaded from CSV into Redis"
echo ""
echo "🎮 Chrome Extension Usage:"
echo "1. Load the Coursera Search Explainer extension in Chrome"
echo "2. Go to Coursera and search for something (e.g., 'ai')"
echo "3. Hover over course cards to see Redis metrics!"
echo ""
echo "🔍 Test the API:"
echo "   curl http://localhost:5000/health"
echo "   curl http://localhost:5000/search/ai"
echo ""
echo "🛠️ Management:"
echo "   Stop all: Ctrl+C (then run 'docker compose down')"
echo "   View logs: docker compose logs -f"
echo "   Redis CLI: docker exec -it redis-node-1 redis-cli -c"
echo ""
echo "📖 For more help, see README.md"
echo ""
echo "⏳ API server running in background (PID: $API_PID)"
echo "Press Ctrl+C to stop everything..."

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $API_PID 2>/dev/null
    echo "✅ API server stopped"
    echo "🐳 Use 'docker-compose down' to stop Redis cluster"
    exit 0
}

# Set trap to catch Ctrl+C
trap cleanup INT

# Keep script running
wait $API_PID 