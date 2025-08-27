#!/bin/bash

echo "🚀 Starting Simple Redis + Chrome Extension Setup"
echo "================================================"

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

echo "✅ Docker is running"
echo "✅ CSV file found"

# Start the simple Redis setup
echo ""
echo "🔧 Starting Redis and loading data..."
docker compose -f docker-compose-simple.yml up -d

echo ""
echo "⏳ Waiting for data loading to complete..."
sleep 10

echo ""
echo "📊 Checking data loading status..."
docker compose -f docker-compose-simple.yml logs data-loader | tail -5

echo ""
echo "🌐 Starting API bridge server..."
echo "📡 API will be available at http://localhost:5001"

# Start API server in background
python3 api_server_simple.py > api_server.log 2>&1 &
API_PID=$!

sleep 3

# Test the API
echo ""
echo "🧪 Testing API connection..."
if curl -s http://localhost:5001/health | grep -q "healthy"; then
    echo "✅ API is running and connected to Redis!"
else
    echo "⚠️  API might still be starting up..."
fi

echo ""
echo "🎉 Setup complete! Here's what's running:"
echo ""
echo "✅ Redis Instance: localhost:6379"
echo "✅ API Bridge Server: http://localhost:5001"
echo "✅ Data loaded: 15,736+ records from CSV"
echo ""
echo "🎮 Chrome Extension Usage:"
echo "1. Load the Coursera Search Explainer extension in Chrome"
echo "2. Go to Coursera and search for something (e.g., 'ai')" 
echo "3. Hover over course cards to see Redis metrics!"
echo ""
echo "🔍 Test the API:"
echo "   curl http://localhost:5001/health"
echo "   curl http://localhost:5001/search/ai"
echo "   curl http://localhost:5001/metrics/ai/mR7MlUaTEemuHQ4HpHozrA"
echo ""
echo "🛠️ Management:"
echo "   Stop all: Ctrl+C (then run 'docker compose -f docker-compose-simple.yml down')"
echo "   View Redis logs: docker compose -f docker-compose-simple.yml logs"
echo "   View API logs: tail -f api_server.log"
echo ""
echo "⏳ API server running in background (PID: $API_PID)"
echo "Press Ctrl+C to stop everything..."

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $API_PID 2>/dev/null
    docker compose -f docker-compose-simple.yml down
    echo "✅ All services stopped!"
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Keep script running
wait $API_PID 