# Architecture Diagram - Editable Mermaid Code

```mermaid
graph TB
    subgraph "User Browser"
        subgraph "Coursera Website"
            CW["Coursera Web Page<br/>https://www.coursera.org/search"]
            GP["GraphQL API<br/>Course Search Requests"]
        end
        
        subgraph "Chrome Extension"
            CS["Content Script<br/>content.js<br/>• DOM manipulation<br/>• Overlay creation<br/>• Event handling"]
            BS["Background Script<br/>background.js<br/>• API calls to Redis<br/>• OpenAI integration<br/>• CORS handling"]
            IS["Interceptor Script<br/>interceptor.js<br/>• GraphQL interception<br/>• Query modification<br/>• Response capture"]
        end
    end
    
    subgraph "Local Development Environment"
        subgraph "Docker Container"
            RD["Redis Database<br/>Port: 6379<br/>• Course metrics cache<br/>• AI explanation cache<br/>• 15,736+ records"]
            DL["Data Loader<br/>load_data_simple.py<br/>• CSV import<br/>• Redis population"]
        end
        
        AS["API Server<br/>api_server_8080.py<br/>Port: 8080<br/>• Flask web server<br/>• CORS enabled<br/>• Redis interface"]
        
        CSV["CSV Data File<br/>(Clone)_SearchQuery_...<br/>• Historical metrics<br/>• Course performance data"]
    end
    
    subgraph "External Services"
        OAI["OpenAI API<br/>GPT-3.5-turbo<br/>• AI explanation formatting<br/>• Structured output"]
    end
    
    %% Data Flow
    CW -->|"1. User searches"| GP
    GP -->|"2. GraphQL request"| IS
    IS -->|"3. Inject searchExplanation field"| GP
    GP -->|"4. Modified GraphQL response"| IS
    IS -->|"5. Capture response data"| CS
    CS -->|"6. User hovers on course card"| CS
    CS -->|"7. Request metrics via message"| BS
    BS -->|"8. HTTP request"| AS
    AS -->|"9. Query Redis"| RD
    RD -->|"10. Return cached data"| AS
    AS -->|"11. JSON response"| BS
    BS -->|"12. Format with OpenAI"| OAI
    OAI -->|"13. Structured explanation"| BS
    BS -->|"14. Cache AI response"| AS
    AS -->|"15. Store in Redis"| RD
    BS -->|"16. Return formatted data"| CS
    CS -->|"17. Display overlay"| CW
    
    %% Setup Flow
    CSV -.->|"Data import"| DL
    DL -.->|"Populate"| RD
    
    %% Styling
    classDef browser fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef extension fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef local fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class CW,GP browser
    class CS,BS,IS extension
    class RD,DL,AS,CSV local
    class OAI external
```

## How to Edit:

### Add a new component:
```mermaid
NEW_COMPONENT["New Component<br/>Description<br/>• Feature 1<br/>• Feature 2"]
```

### Change colors:
```mermaid
classDef newcolor fill:#ff9999,stroke:#cc0000,stroke-width:2px
class NEW_COMPONENT newcolor
```

### Add connections:
```mermaid
COMPONENT1 -->|"Label"| COMPONENT2
```

### Remove components:
Just delete the lines for components you don't want.

## Tools you can use to edit:

1. **Mermaid Live Editor**: https://mermaid.live/
2. **GitHub/GitLab**: Both support Mermaid in markdown
3. **VS Code**: With Mermaid extension
4. **Draw.io**: Can import Mermaid code

Copy the code above and paste it into any of these tools to edit visually!
