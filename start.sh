#!/bin/bash

echo "🚀 Starting Redis Cluster with Coursera Data"
echo "============================================"

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

# Start the cluster
echo ""
echo "🔧 Starting Redis cluster..."
docker-compose up -d

echo ""
echo "⏳ Waiting for cluster to initialize (this may take up to 2 minutes)..."
sleep 30

# Check if cluster is ready
echo "🔍 Checking cluster status..."
if docker exec redis-node-1 redis-cli --cluster check localhost:6379 > /dev/null 2>&1; then
    echo "✅ Redis cluster is healthy!"
else
    echo "⚠️  Cluster may still be initializing. Check logs with:"
    echo "   docker-compose logs redis-cluster-init"
fi

# Check data loading
echo ""
echo "📊 Checking data loading status..."
docker-compose logs data-loader | tail -10

echo ""
echo "🎉 Setup complete! Here's what you can do next:"
echo ""
echo "📋 View cluster status:"
echo "   docker exec -it redis-node-1 redis-cli -c"
echo ""
echo "📊 Monitor data loading:"
echo "   docker-compose logs -f data-loader"
echo ""
echo "🔍 Query your data:"
echo "   python3 query_data.py"
echo ""
echo "🛠️ Manage cluster:"
echo "   docker-compose down    # Stop cluster"
echo "   docker-compose down -v # Stop and remove data"
echo ""
echo "📖 For more help, see README.md" 