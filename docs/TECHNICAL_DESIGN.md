# Coursera Search Intelligence: Technical Design Document

## 🏗️ System Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   CDN/WAF   │    │Load Balancer │    │  API Gateway │   │
│  │             │────▶│              │────▶│  (Auth/Rate  │   │
│  │  CloudFlare │    │   HAProxy    │    │   Limiting)  │   │
│  └─────────────┘    └──────────────┘    └──────────────┘   │
│                                                 │           │
│  ┌─────────────────────────────────────────────┼───────────┤
│  │              Microservices Layer            │           │
│  │  ┌─────────────────┐  ┌─────────────────┐   │           │
│  │  │  Search Analytics│  │  AI Enhancement │   │           │
│  │  │     Service     │  │     Service     │   │           │
│  │  │                 │  │                 │   │           │
│  │  │ • Metrics API   │  │ • OpenAI Proxy  │   │           │
│  │  │ • Performance   │  │ • Caching       │   │           │
│  │  │ • Aggregation   │  │ • Fallbacks     │   │           │
│  │  └─────────────────┘  └─────────────────┘   │           │
│  │                                             │           │
│  │  ┌─────────────────┐  ┌─────────────────┐   │           │
│  │  │ User Management │  │   Notification  │   │           │
│  │  │    Service      │  │     Service     │   │           │
│  │  │                 │  │                 │   │           │
│  │  │ • SSO Integration│  │ • Alerts        │   │           │
│  │  │ • RBAC          │  │ • Webhooks      │   │           │
│  │  │ • User Profiles │  │ • Email/Slack   │   │           │
│  │  └─────────────────┘  └─────────────────┘   │           │
│  └─────────────────────────────────────────────┼───────────┤
│                                                 │           │
│  ┌─────────────────────────────────────────────┼───────────┤
│  │                Data Layer                   │           │
│  │  ┌─────────────────┐  ┌─────────────────┐   │           │
│  │  │   PostgreSQL    │  │   Redis Cluster │   │           │
│  │  │    Primary      │  │                 │   │           │
│  │  │                 │  │ • Session Cache │   │           │
│  │  │ • User Data     │  │ • API Cache     │   │           │
│  │  │ • Config        │  │ • AI Responses  │   │           │
│  │  │ • Audit Logs    │  │                 │   │           │
│  │  └─────────────────┘  └─────────────────┘   │           │
│  │                                             │           │
│  │  ┌─────────────────┐  ┌─────────────────┐   │           │
│  │  │  Analytics DW   │  │  Backup Store   │   │           │
│  │  │   (BigQuery/    │  │   (S3/GCS)      │   │           │
│  │  │   Snowflake)    │  │                 │   │           │
│  │  └─────────────────┘  └─────────────────┘   │           │
│  └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Chrome Extension│  │   Web Dashboard │  │Mobile App   │  │
│  │                 │  │                 │  │ (Future)    │  │
│  │ • Content Script│  │ • Admin Panel   │  │             │  │
│  │ • Background    │  │ • Analytics View│  │             │  │
│  │ • Popup UI      │  │ • User Mgmt     │  │             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Service Specifications

### 1. Search Analytics Service

#### Responsibilities
- Course performance metrics aggregation
- Historical data analysis
- Real-time performance monitoring
- A/B test impact tracking

#### API Endpoints
```yaml
GET /api/v1/metrics/{query}/{courseId}
  - Returns: CTR, enrollments, completion rates
  - Cache: 5 minutes
  - Rate limit: 100/minute per user

GET /api/v1/search/{query}
  - Returns: All courses for query with basic metrics
  - Cache: 2 minutes
  - Rate limit: 50/minute per user

GET /api/v1/trends/{courseId}
  - Returns: Historical performance data
  - Cache: 1 hour
  - Rate limit: 20/minute per user

POST /api/v1/events
  - Accepts: Real-time interaction events
  - Processing: Async via message queue
  - Rate limit: 1000/minute per user
```

#### Database Schema
```sql
-- Course Performance Metrics
CREATE TABLE course_metrics (
    id SERIAL PRIMARY KEY,
    course_id VARCHAR(255) NOT NULL,
    query VARCHAR(500) NOT NULL,
    ctr DECIMAL(5,4),
    enrollments INTEGER,
    completion_rate DECIMAL(5,4),
    avg_rating DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, query, DATE(created_at))
);

-- Search Performance Tracking
CREATE TABLE search_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    query VARCHAR(500),
    course_id VARCHAR(255),
    event_type VARCHAR(50), -- view, click, enroll
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- A/B Test Tracking
CREATE TABLE ab_test_results (
    id SERIAL PRIMARY KEY,
    test_id VARCHAR(255),
    variant VARCHAR(255),
    query VARCHAR(500),
    course_id VARCHAR(255),
    metric_name VARCHAR(255),
    metric_value DECIMAL(10,4),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. AI Enhancement Service

#### Responsibilities
- OpenAI API integration and management
- Response caching and optimization
- Fallback content generation
- Cost monitoring and optimization

#### API Endpoints
```yaml
POST /api/v1/ai/enhance
  - Body: { searchExplanation, courseMetadata, userContext }
  - Returns: Enhanced, structured explanation
  - Cache: 24 hours
  - Rate limit: 30/minute per user

GET /api/v1/ai/cache/stats
  - Returns: Cache hit rates, cost metrics
  - Admin only

DELETE /api/v1/ai/cache/flush
  - Clears AI response cache
  - Admin only
```

#### Caching Strategy
```python
# Multi-layer caching
def get_ai_explanation(query, course_id, explanation_data):
    # Layer 1: In-memory cache (1 hour)
    cache_key = f"ai:{hash(query)}:{course_id}"
    if cache_key in memory_cache:
        return memory_cache[cache_key]
    
    # Layer 2: Redis cache (24 hours)
    redis_result = redis.get(cache_key)
    if redis_result:
        memory_cache[cache_key] = redis_result
        return redis_result
    
    # Layer 3: OpenAI API call
    result = call_openai_api(explanation_data)
    
    # Cache results
    redis.setex(cache_key, 86400, result)  # 24 hours
    memory_cache[cache_key] = result
    
    return result
```

### 3. User Management Service

#### Responsibilities
- SSO integration (SAML/OAuth)
- Role-based access control
- User preferences and settings
- Audit logging

#### Database Schema
```sql
-- Users and Authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    team_id INTEGER REFERENCES teams(id),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Teams and Access Control
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255),
    resource VARCHAR(255),
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Notification Service

#### Responsibilities
- Performance alerts
- System health notifications
- Integration with Slack/Teams
- Email notifications

#### Configuration
```yaml
# Alert Rules
alerts:
  - name: "CTR Drop Alert"
    condition: "ctr < 0.05 AND previous_ctr > 0.08"
    threshold: 50  # Minimum course views
    frequency: "daily"
    channels: ["slack", "email"]
    recipients: ["product-team", "marketing-team"]
  
  - name: "High Performing Course"
    condition: "ctr > 0.15 AND enrollments > 100"
    frequency: "weekly"
    channels: ["slack"]
    recipients: ["product-team"]
```

## 🗄️ Data Pipeline Architecture

### ETL Pipeline
```yaml
Data Sources:
  - Production Analytics Database
  - Search Logs
  - User Interaction Events
  - A/B Test Results

Processing Pipeline:
  1. Extract (Every 15 minutes)
     - Incremental data extraction
     - Change data capture (CDC)
  
  2. Transform
     - Data cleaning and validation
     - Metric calculation
     - Aggregation by time periods
  
  3. Load
     - Update PostgreSQL tables
     - Refresh Redis cache
     - Update search indexes

Real-time Processing:
  - Kafka/Pulsar for event streaming
  - Apache Flink for real-time aggregation
  - WebSocket updates for live dashboards
```

### Data Retention Policy
```yaml
Raw Events: 90 days
Aggregated Metrics: 2 years
AI Explanations: 30 days (with LRU eviction)
Audit Logs: 7 years (compliance)
User Sessions: 30 days
```

## 🚀 Deployment Strategy

### Kubernetes Deployment
```yaml
# Example service deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: search-analytics-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: search-analytics
  template:
    metadata:
      labels:
        app: search-analytics
    spec:
      containers:
      - name: search-analytics
        image: coursera/search-analytics:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

### CI/CD Pipeline
```yaml
stages:
  - test
  - build
  - security-scan
  - deploy-staging
  - integration-tests
  - deploy-production

test:
  script:
    - pytest tests/
    - npm test
    - integration_tests.sh
  coverage: 85%

security-scan:
  script:
    - snyk test
    - docker scan
    - sonarqube analysis

deploy-production:
  script:
    - kubectl apply -f k8s/
    - helm upgrade --install coursera-intelligence ./helm-chart
  only:
    - main
  when: manual
```

## 📊 Monitoring & Observability

### Metrics to Track
```yaml
Application Metrics:
  - Request latency (p50, p95, p99)
  - Error rates by endpoint
  - Cache hit rates
  - API call success rates

Business Metrics:
  - Active users per day/week
  - Feature usage statistics
  - Performance improvement measurements
  - Cost per AI explanation

Infrastructure Metrics:
  - CPU and memory usage
  - Database connection pools
  - Queue lengths
  - Network latency
```

### Alerting Rules
```yaml
Critical Alerts:
  - API error rate > 5%
  - Response time > 2 seconds (p95)
  - Database connections > 80%
  - Redis memory usage > 90%

Warning Alerts:
  - Cache hit rate < 80%
  - AI API cost > $500/day
  - User complaints > 3/day
```

## 🔒 Security Implementation

### Authentication & Authorization
```python
# JWT-based authentication
class AuthenticationMiddleware:
    def __init__(self):
        self.jwt_secret = os.getenv('JWT_SECRET')
        self.sso_provider = SSOProvider()
    
    def authenticate(self, request):
        token = extract_token(request)
        if not token:
            return self.sso_provider.authenticate(request)
        
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
            return User.from_payload(payload)
        except jwt.InvalidTokenError:
            raise AuthenticationError()

# Role-based access control
@require_role(['admin', 'product_manager'])
def flush_cache():
    cache.flush_all()
    return {'status': 'success'}

@require_permission('view_analytics')
def get_metrics(query, course_id):
    return analytics.get_metrics(query, course_id)
```

### Data Privacy
```python
# PII data handling
class PIIHandler:
    def __init__(self):
        self.cipher = Fernet(os.getenv('ENCRYPTION_KEY'))
    
    def encrypt_sensitive_data(self, data):
        if contains_pii(data):
            return self.cipher.encrypt(data.encode())
        return data
    
    def audit_data_access(self, user, resource, action):
        AuditLog.create(
            user_id=user.id,
            resource=resource,
            action=action,
            timestamp=datetime.utcnow(),
            ip_address=get_client_ip()
        )
```

## 🧪 Testing Strategy

### Test Coverage Requirements
```yaml
Unit Tests: >90% coverage
  - Service logic
  - Data transformations
  - Authentication/authorization

Integration Tests: 
  - API endpoint testing
  - Database operations
  - External service mocks

End-to-End Tests:
  - Chrome extension workflows
  - Full user journeys
  - Performance testing

Load Testing:
  - 1000 concurrent users
  - 10x expected traffic
  - Failure mode testing
```

### Test Automation
```python
# Example integration test
class TestSearchAnalytics:
    def test_metrics_endpoint(self):
        response = client.get('/api/v1/metrics/ai/course123')
        assert response.status_code == 200
        assert 'ctr' in response.json()
        assert response.json()['ctr'] >= 0
    
    def test_caching_behavior(self):
        # First call should hit database
        start_time = time.time()
        response1 = client.get('/api/v1/metrics/ai/course123')
        first_call_time = time.time() - start_time
        
        # Second call should hit cache
        start_time = time.time()
        response2 = client.get('/api/v1/metrics/ai/course123')
        second_call_time = time.time() - start_time
        
        assert second_call_time < first_call_time * 0.5
        assert response1.json() == response2.json()
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- Indexes for common queries
CREATE INDEX idx_course_metrics_query_course ON course_metrics(query, course_id);
CREATE INDEX idx_course_metrics_created_at ON course_metrics(created_at DESC);
CREATE INDEX idx_search_events_user_created ON search_events(user_id, created_at);

-- Partitioning for large tables
CREATE TABLE search_events_202501 PARTITION OF search_events
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Caching Strategy
```python
# Multi-level caching implementation
class CacheManager:
    def __init__(self):
        self.l1_cache = {}  # In-memory
        self.l2_cache = Redis()  # Redis
        self.l3_cache = Database()  # PostgreSQL
    
    def get(self, key):
        # L1 Cache (fastest)
        if key in self.l1_cache:
            return self.l1_cache[key]
        
        # L2 Cache (fast)
        value = self.l2_cache.get(key)
        if value:
            self.l1_cache[key] = value
            return value
        
        # L3 Cache (database)
        value = self.l3_cache.get(key)
        if value:
            self.l2_cache.setex(key, 3600, value)
            self.l1_cache[key] = value
        
        return value
```

---

*This technical design provides the detailed blueprint for implementing the production-ready Coursera Search Intelligence platform, ensuring scalability, security, and maintainability.*
