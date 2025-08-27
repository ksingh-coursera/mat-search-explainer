# Redis Cluster with Coursera Search Data

This project sets up a local Redis cluster and loads Coursera search query metrics data into it using a specific JSON format.

## 📋 Data Format

The CSV data is transformed into Redis with the following structure:

**Key Format:** `{searched_query}:{clicked_product}`

**Value Format:**
```json
{
  "viewers": 17899,
  "clickers": 17899,
  "enrollers": 2622,
  "paid_enrollers": 1070,
  "ctr": 100.00,
  "enrollment_rate": 14.65,
  "paid_conversion_rate": 0.01
}
```

## 🏗️ Architecture

- **6 Redis Nodes**: 3 masters + 3 replicas for high availability
- **Ports**: 7001-7006 for Redis nodes, 17001-17006 for cluster communication
- **Data Persistence**: AOF enabled with RDB snapshots
- **Memory Policy**: LRU eviction with 256MB limit per node

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Python 3.11+ (for API server)
- Chrome browser with the Coursera Search Explainer extension
- Your CSV file named `(Clone)_SearchQuery_productid_level_metric_2025_07_17.csv` in the project directory

### 1. Start the Redis Cluster
```bash
docker-compose up -d
```

This will:
- Start 6 Redis nodes
- Initialize the cluster
- Load your CSV data automatically

### 2. Start the API Bridge Server
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the API server (bridges Chrome extension to Redis)
python3 api_server.py
```

The API server will start on `http://localhost:5000` and enables the Chrome extension to query Redis metrics.

### 3. Use with Chrome Extension
1. Load the Coursera Search Explainer extension in Chrome
2. Navigate to any Coursera search page (e.g., search for "machine learning")
3. Hover over course cards to see:
   - **GraphQL API data** (existing functionality)
   - **Redis metrics** (historical performance data)
   - **Apollo cache data** (existing functionality)

### 4. Monitor the Data Loading
```bash
docker-compose logs -f data-loader
```

### 5. Verify the Cluster Status
```bash
# Connect to any Redis node
docker exec -it redis-node-1 redis-cli -c

# Check cluster status
CLUSTER INFO
CLUSTER NODES

# Get total number of keys
DBSIZE

# Sample some data
KEYS *ai* | head -5
```

## 🔧 Manual Operations

### Connect to Redis Cluster
```bash
# Using redis-cli with cluster support
docker exec -it redis-node-1 redis-cli -c

# Or connect from host (if you have redis-cli installed)
redis-cli -c -h localhost -p 7001
```

### Query Data Examples
```bash
# Get data for a specific search query and product
GET "ai:mR7MlUaTEemuHQ4HpHozrA"

# Find all products for "ai" search queries
KEYS "ai:*"

# Find all "ai for everyone" search queries
KEYS "ai for everyone:*"

# Get multiple keys at once
MGET "ai:mR7MlUaTEemuHQ4HpHozrA" "ai:nI__WUzdEe64qQ7qqom4Rw"
```

### Performance Testing
```bash
# Benchmark the cluster
docker exec -it redis-node-1 redis-benchmark -c 50 -n 10000 -t set,get
```

## 📊 Data Analysis Examples

### Using Redis CLI
```bash
# Count total search queries
EVAL "return #redis.call('keys', '*')" 0

# Get top 10 most popular search terms (requires custom script)
# This would need a Lua script to aggregate by search query prefix
```

### Using Python Client
```python
from rediscluster import RedisCluster
import json

# Connect to cluster
startup_nodes = [{"host": "localhost", "port": "7001"}]
rc = RedisCluster(startup_nodes=startup_nodes, decode_responses=True)

# Get all keys for "ai" searches
ai_keys = list(rc.scan_iter(match="ai:*"))
print(f"Found {len(ai_keys)} AI-related products")

# Analyze enrollment rates for AI courses
for key in ai_keys[:5]:
    data = json.loads(rc.get(key))
    print(f"{key}: {data['enrollment_rate']}% enrollment rate")
```

## 🔍 Monitoring

### Cluster Health
```bash
# Check cluster health
docker exec -it redis-node-1 redis-cli --cluster check localhost:7001

# Monitor cluster in real-time
docker exec -it redis-node-1 redis-cli --cluster info localhost:7001
```

### Resource Usage
```bash
# Check memory usage per node
docker exec -it redis-node-1 redis-cli INFO memory
docker exec -it redis-node-2 redis-cli INFO memory
# ... etc for all nodes
```

## 🛠️ Maintenance

### Stop the Cluster
```bash
docker-compose down
```

### Stop and Remove All Data
```bash
docker-compose down -v
```

### Restart Only Data Loading
```bash
docker-compose up data-loader
```

### Scale Operations
To add more data or reload:

1. Update your CSV file
2. Run: `docker-compose up data-loader`

## 📁 File Structure

```
.
├── docker-compose.yml      # Main orchestration file
├── Dockerfile             # Data loader container
├── redis-cluster.conf     # Redis configuration
├── load_data.py           # Data loading script
├── (Clone)_SearchQuery_productid_level_metric_2025_07_17.csv  # Your data
└── README.md              # This file
```

## 🐛 Troubleshooting

### Cluster Won't Start
- Ensure no processes are using ports 7001-7006
- Check Docker daemon is running
- Verify sufficient memory (recommended: 2GB+)

### Data Loading Fails
- Verify CSV file exists and has correct format
- Check container logs: `docker-compose logs data-loader`
- Ensure cluster is fully initialized before data loading

### Connection Issues
- Wait 30-60 seconds after startup for cluster initialization
- Use `-c` flag with redis-cli for cluster support
- Check firewall settings if connecting from external machines

## 🎯 Chrome Extension Integration

### How It Works
When you hover over a course card on Coursera with the extension active:

1. **Search Query Detection**: Extracts the current search query from the URL or page context
2. **Product ID Extraction**: Gets the course/product ID from the card data
3. **Redis Lookup**: Queries Redis using the key format: `{search_query}:{product_id}`
4. **Overlay Display**: Shows historical metrics alongside existing GraphQL data

### Example Usage
Search for "ai" on Coursera, then hover over any course card to see:

```
📈 Redis Metrics - Historical Performance
Search Query: "ai"
Product ID: mR7MlUaTEemuHQ4HpHozrA

👀 Viewers: 17,899        🖱️ Clickers: 17,899
📚 Enrollers: 2,622       💰 Paid Enrollers: 1,070
🎯 CTR: 100.00%          📈 Enrollment Rate: 14.65%
💵 Paid Conversion Rate: 0.01%
```

### API Endpoints
The bridge server provides these endpoints:

- `GET /health` - Check API and Redis status
- `GET /metrics/{query}/{product_id}` - Get specific metrics
- `GET /search/{query}` - Get all products for a query
- `GET /stats` - Get cluster statistics

### Troubleshooting Extension Integration

**"Redis API Unavailable" Message:**
- Ensure API server is running: `python3 api_server.py`
- Check Redis cluster is running: `docker-compose ps`

**"No Historical Data" Message:**
- The search query + product combination isn't in your CSV data
- Try different search terms that exist in your dataset

**Extension Not Working:**
- Check browser console for error messages
- Verify extension is loaded and active
- Make sure you're on a Coursera search results page

## 🎯 Next Steps

- Set up Redis monitoring (e.g., RedisInsight)
- Implement data expiration policies if needed
- Add backup/restore procedures
- Create custom analytics scripts for your specific use cases
- Extend the API to support more complex queries and analytics 