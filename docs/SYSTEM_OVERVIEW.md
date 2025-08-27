# Coursera Search Intelligence: System Overview

## 🎯 Current Prototype Components

### **Chrome Extension (3 Scripts)**

#### **Content Script (`content.js`)**
- **Function**: User interface controller
- **Responsibilities**: Creates hover overlays on course cards, manages DOM manipulation, handles user interactions
- **Data**: Receives course performance metrics and displays them in collapsible sections with AI explanations

#### **Background Script (`background.js`)**  
- **Function**: API communication hub
- **Responsibilities**: Makes HTTP requests to local API server, integrates with OpenAI for explanation formatting, manages in-memory caching
- **Data**: Processes Redis responses and OpenAI API calls, handles CORS bypass for extension

#### **Interceptor Script (`interceptor.js`)**
- **Function**: GraphQL query enhancer  
- **Responsibilities**: Intercepts Coursera's search requests, injects `searchExplanation` field into queries, captures enhanced responses
- **Data**: Modifies outbound GraphQL queries and extracts `searchExplanation` data from responses

### **Local API Server (`api_server_8080.py`)**
- **Function**: Flask web server bridging extension to data
- **Responsibilities**: Serves metrics data via REST endpoints, handles Redis connections, provides OpenAI integration endpoints
- **Data**: Queries Redis for course metrics, caches AI explanations with 30-day TTL
- **Endpoints**: `/health`, `/search/<query>`, `/metrics/<query>/<course>`, `/ai-explanation/*`

### **Redis Database (Docker)**
- **Function**: Primary data store and cache
- **Responsibilities**: Stores 15,736+ course performance records, caches AI explanations, provides sub-100ms response times
- **Data Structure**: Keys as `<query>:<courseId>`, values as JSON with CTR, enrollments, completion rates
- **Cache**: Separate namespaces for metrics (`<query>:<courseId>`) and AI responses (`ai_explanation:<query>:<courseId>`)

### **Data Pipeline**
- **CSV Import**: Historical course performance data loaded via `load_data_simple.py`
- **OpenAI Integration**: GPT-3.5-turbo formats raw `searchExplanation` into structured, categorized insights
- **Caching Strategy**: Dual-layer (in-memory + Redis) to optimize API costs and response times

---

## 🚀 Production Architecture Changes

### **Data Infrastructure**

#### **Replace Local Redis with Cloud Data Store**
- **Primary Option**: **Nostos** - Coursera's internal data platform
  - **Function**: Centralized metrics storage with automated data pipeline from MEGA
  - **Advantages**: Native integration with existing Coursera data infrastructure
  - **Data**: Real-time course performance metrics, search analytics, user engagement data

- **Alternative Option**: **DynamoDB** 
  - **Function**: Managed NoSQL database for metrics storage
  - **Advantages**: Auto-scaling, managed service, potentially easier MEGA pipeline integration
  - **Data Structure**: Partition key as query, sort key as courseId, TTL for data freshness

#### **Production Data Pipeline**
- **Source**: MEGA (Coursera's analytics platform)
- **ETL Process**: Automated daily/hourly data sync to populate course performance metrics
- **Data Freshness**: Real-time or near-real-time updates for current search performance
- **Volume**: Scale to handle millions of course-query combinations

### **Caching Layer**

#### **Redis Cluster (Production)**
- **Function**: High-performance distributed cache
- **Responsibilities**: Cache AI explanations (24-hour TTL), frequently accessed metrics (1-hour TTL), session data
- **Configuration**: Multi-node cluster with failover, separate cache pools for different data types
- **Cost Optimization**: 24-hour TTL for AI explanations to minimize OpenAI API calls and data store queries

### **Authentication & Security**

#### **Courserian-Level Authentication**
- **Function**: Enterprise SSO integration
- **Implementation**: SAML/OAuth integration with Coursera's identity provider
- **Access Control**: Role-based permissions (Product, Marketing, Engineering teams)
- **Audit Logging**: Track usage, data access, and system interactions for compliance

#### **API Security**
- **Function**: Secure API access with rate limiting
- **Implementation**: JWT tokens, API gateways, request validation
- **Monitoring**: Track API usage, detect anomalies, prevent misuse

### **Chrome Extension (Enhanced)**

#### **Configuration Management**
- **Function**: Environment-aware extension with production endpoints
- **Changes**: Dynamic API endpoint configuration, production vs. staging environments
- **Security**: Secure token storage, encrypted communication with backend services

#### **Code Reusability**
- **Function**: Same core extension logic with configurable data sources
- **Implementation**: Abstract data layer to switch between local Redis, Nostos, or DynamoDB
- **Deployment**: Version management for different environments (dev, staging, production)

### **AI Integration (Production)**

#### **OpenAI API Management**
- **Function**: Enterprise-grade AI explanation generation
- **Implementation**: Dedicated OpenAI organization account with usage monitoring
- **Cost Control**: 24-hour cache TTL, batch processing for multiple explanations
- **Fallback**: Graceful degradation when AI service unavailable

#### **Explanation Generation**
- **Function**: Format raw `searchExplanation` data into structured insights
- **Data Flow**: Nostos/DynamoDB → Redis Cache → OpenAI (if not cached) → Formatted Response
- **Optimization**: Aggressive caching to minimize API costs while maintaining data freshness

---

## 📊 Architecture Comparison

| Component | **Current (Prototype)** | **Production** |
|-----------|------------------------|----------------|
| **Data Store** | Local Redis + CSV | Nostos/DynamoDB + Redis Cache |
| **Data Pipeline** | Manual CSV import | Automated MEGA → Data Store ETL |
| **Authentication** | None (localhost only) | Courserian SSO + RBAC |
| **Caching** | 30-day Redis TTL | 24-hour Redis TTL + multi-tier |
| **Deployment** | Local development only | Enterprise Kubernetes cluster |
| **Monitoring** | Console logs | Full observability stack |
| **Security** | Local network only | Enterprise security + audit logs |
| **Scalability** | Single user | Organization-wide deployment |

---

## 🔄 Migration Strategy

### **Phase 1: Data Migration**
1. **Set up Nostos/DynamoDB** connection and data schema
2. **Build ETL pipeline** from MEGA to production data store  
3. **Parallel testing** with current Redis setup for validation

### **Phase 2: Infrastructure**
1. **Deploy Redis cluster** in production environment
2. **Implement authentication** and security layers
3. **Set up monitoring** and alerting systems

### **Phase 3: Extension Updates**
1. **Update extension** to use production API endpoints
2. **Add authentication** flow and token management
3. **Deploy gradual rollout** to internal teams

### **Phase 4: Optimization**
1. **Fine-tune caching** TTL values based on usage patterns
2. **Optimize OpenAI** integration and cost management
3. **Scale infrastructure** based on adoption metrics

The production solution maintains the same core functionality while adding enterprise-grade reliability, security, and scalability needed for organization-wide deployment.
