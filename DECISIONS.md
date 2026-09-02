# Architectural Decision Records (ADRs)

Visual summary of all major architectural decisions made in this project. For detailed write-ups, see [`docs/architecture/`](docs/architecture/).

---

## ADR-001: Four-Service Topology

**Decision**: Split into 4 independent services instead of a monolith.

**Why**: Language fit (Node for CRUD/auth, Python for AI/AST), blast radius isolation, statelessness boundary, and independent deploys.

```mermaid
graph LR
    subgraph "External"
        GH["GitHub<br/>App + Webhooks"]
        U["User Browser"]
    end

    subgraph "Internal Services"
        WEB["apps/web<br/>Next.js"]
        API["apps/api<br/>Node + Express"]
        AI["apps/ai-service<br/>Python + FastAPI"]
        IDX["apps/indexer-service<br/>Python + FastAPI"]
    end

    subgraph "Data Stores"
        PG["PostgreSQL"]
        NEO["Neo4j<br/>Code Graph"]
        RD["Redis"]
        INN["Inngest<br/>Durable Jobs"]
    end

    U --> WEB --> API
    GH -->|Webhooks| API
    API -->|Circuit Breaker| AI
    API --> IDX
    API --> PG
    API --> INN
    API --> RD
    IDX --> NEO
    API -->|Read-only Cypher| NEO
```

---

## ADR-003: Python AI Service Boundary

**Decision**: AI compute is a stateless Python service behind a circuit breaker.

**Why**: Python owns the AI SDK ecosystem. Stateless `(diff, context) → findings` makes it horizontally scalable. Never touches Postgres or GitHub credentials.

```mermaid
flowchart LR
    API["apps/api<br/>(Node.js)"]
    CB["Opossum<br/>Circuit Breaker"]
    AI["apps/ai-service<br/>(FastAPI)"]
    LLM["OpenAI API"]

    API -->|HTTP POST| CB -->|if CLOSED| AI -->|Structured Output| LLM
    CB -->|if OPEN| API
    AI -->|JSON Response| API

    style CB fill:#f59e0b,stroke:#d97706,color:#000
```

**Trade-offs**:
- ✅ If AI service is degraded, API stays up (users can login, browse past reviews)
- ✅ Prompt/model changes don't require API redeployment
- ⚠️ Extra network hop (~5ms latency), acceptable for AI calls

---

## ADR-005: Inngest Event-Driven Job Pipeline

**Decision**: Use Inngest for durable, step-based job orchestration instead of raw Redis queues.

**Why**: Each review pipeline step (fetch diff → graph impact → AI review → post comment) is independently retryable. No custom retry/dead-letter logic needed.

```mermaid
flowchart TD
    WH["Webhook Received"]
    S1["Step 1: Fetch PR Diff"]
    S2["Step 2: Analyze Graph Impact"]
    S3["Step 3: Build Review Context"]
    S4["Step 4: Generate AI Review"]
    S5["Step 5: Post GitHub Comment"]
    S6["Step 6: Update Status"]

    WH --> S1 --> S2 --> S3 --> S4 --> S5 --> S6

    S1 -.->|retry on fail| S1
    S4 -.->|retry on fail| S4

    style S2 fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style S4 fill:#8b5cf6,stroke:#7c3aed,color:#fff
```

---

## ADR-006: Resilience — Circuit Breaker Pattern

**Decision**: All `api → ai-service` calls wrapped in an Opossum circuit breaker.

**Why**: Prevents cascade failures. If AI service returns 5 consecutive failures, breaker opens for 30s — subsequent requests fail fast instead of piling up timeouts.

| State | Behavior |
|---|---|
| **CLOSED** | Requests flow normally. Failures increment counter. |
| **OPEN** | All requests instantly rejected. Timer starts. |
| **HALF-OPEN** | One probe request allowed. Success → CLOSED, Failure → OPEN. |

---

## ADR-009: Comment Strategy & Conversational Bot

**Decision**: One summary comment per PR review (not inline review comments). Bot responds to @mentions in PR threads.

**Why**: Single summary avoids notification spam. @mention-based conversation is unambiguous and needs no heuristic tuning.

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant API as apps/api
    participant AI as apps/ai-service

    Dev->>GH: Opens PR
    GH->>API: pull_request.opened webhook
    API->>AI: Generate review
    AI-->>API: Structured findings
    API->>GH: Post summary comment

    Dev->>GH: @bot "I'll fix the auth issue"
    GH->>API: issue_comment.created webhook
    API->>AI: Generate conversational reply
    AI-->>API: Context-aware response
    API->>GH: Post threaded reply
```

---

## ADR-010: Code Knowledge Graph (Neo4j + Tree-sitter)

**Decision**: Parse repositories into a Neo4j graph using Tree-sitter AST analysis instead of storing raw text chunks.

**Why**: Structural relationships (CALLS, IMPORTS, DEFINED_IN, HANDLES_ROUTE) enable blast-radius analysis that text similarity search cannot achieve.

```mermaid
graph TD
    subgraph "Neo4j Code Knowledge Graph"
        F1["File<br/>auth.service.js"]
        F2["File<br/>user.controller.js"]
        FN1["Function<br/>validateToken()"]
        FN2["Function<br/>handleLogin()"]
        FN3["Function<br/>getUserProfile()"]
        CL["Class<br/>AuthService"]
        EP["APIEndpoint<br/>POST /auth/login"]

        FN1 -->|DEFINED_IN| F1
        FN2 -->|DEFINED_IN| F1
        FN3 -->|DEFINED_IN| F2
        CL -->|DEFINED_IN| F1
        FN2 -->|CALLS| FN1
        FN3 -->|CALLS| FN1
        EP -->|HANDLES_ROUTE| FN2
        F2 -->|IMPORTS| F1
    end

    style FN1 fill:#ef4444,stroke:#dc2626,color:#fff
    style EP fill:#3b82f6,stroke:#2563eb,color:#fff
```

**Incremental Update Strategy**:
- On PR merge → SHA256 hash check per file → only re-parse changed files
- Delete old subgraph for modified files → re-insert new symbols
- Zero embedding cost (pure AST, no OpenAI calls)

---

## ADR-011: Chat with Repo — Hybrid Graph-RAG (No Vector DB)

> **Status**: Approved  
> **Date**: 2026-09-02

**Decision**: Implement "Chat with your Repo" using **Hybrid Graph-RAG** that queries the existing Neo4j code knowledge graph directly, instead of adding a vector database (Qdrant/pgvector).

### Context

Users want to ask natural language questions about their indexed repositories:
- *"Who calls the handleAuth function?"* (structural)
- *"How does the review pipeline work?"* (semantic/architectural)
- *"What API endpoints exist?"* (enumeration)

Three approaches were evaluated:

### Options Considered

```mermaid
graph TB
    subgraph "Option A: Pure Vector RAG ❌"
        A1["Chunk code into text blocks"]
        A2["Embed with OpenAI text-embedding-3"]
        A3["Store in Qdrant"]
        A4["Similarity search on query"]
        A5["Top-K chunks → LLM"]

        A1 --> A2 --> A3 --> A4 --> A5
    end

    subgraph "Option B: Pure Graph (Text-to-Cypher) ⚠️"
        B1["LLM generates Cypher query"]
        B2["Execute on Neo4j"]
        B3["Return raw graph results"]

        B1 --> B2 --> B3
    end

    subgraph "Option C: Hybrid Graph-RAG ✅"
        C1["gpt-4o-mini: Classify intent"]
        C2["Extract entity names"]
        C3["Targeted Cypher queries"]
        C4["Build context from subgraph"]
        C5["gpt-4o: Generate grounded answer"]

        C1 --> C2 --> C3 --> C4 --> C5
    end

    style A1 fill:#fee2e2,stroke:#fca5a5
    style A5 fill:#fee2e2,stroke:#fca5a5
    style B3 fill:#fef3c7,stroke:#fcd34d
    style C1 fill:#dcfce7,stroke:#86efac
    style C5 fill:#dcfce7,stroke:#86efac
```

### Trade-off Matrix

| Criteria | Pure Vector RAG | Pure Graph | **Hybrid Graph-RAG** |
|---|---|---|---|
| Structural accuracy | ❌ No call-graph awareness | ✅ Deterministic | ✅ **Deterministic** |
| Semantic questions | ✅ Fuzzy similarity | ⚠️ Needs exact names | ✅ **Intent → Graph** |
| Incremental updates | ❌ Re-embed on every merge | ✅ SHA256 delta | ✅ **Zero cost** |
| Multi-tenant RAM cost | ❌ High (HNSW per repo) | ✅ Low (disk-based) | ✅ **Minimal** |
| LLM token cost/query | ❌ ~8K tokens (raw chunks) | ✅ ~2K (precise) | ✅ **~4K (targeted)** |
| Embedding API cost | ❌ $0.13/1M tokens | ✅ $0 | ✅ **$0** |
| New infrastructure | ❌ Qdrant container | ✅ None | ✅ **None** |

### Pipeline Architecture

```mermaid
sequenceDiagram
    participant User
    participant API as apps/api
    participant Neo as Neo4j
    participant AI as apps/ai-service
    participant Fast as gpt-4o-mini
    participant Deep as gpt-4o

    User->>API: "Who calls validateToken?"
    API->>Neo: Fetch graph schema summary (cached)
    API->>AI: POST /chat/classify
    AI->>Fast: Classify intent + extract entities
    Fast-->>AI: {intent: "structural", entities: ["validateToken"]}
    AI-->>API: Query plan

    API->>Neo: MATCH (c)-[:CALLS]->(f {name: "validateToken"})
    Neo-->>API: Caller subgraph (3 functions, 2 files)

    API->>AI: POST /chat/generate (SSE)
    AI->>Deep: System prompt + graph context + question
    Deep-->>AI: Streaming tokens
    AI-->>API: SSE stream
    API-->>User: SSE stream + citations
```

### Dual-Model Cost Strategy

| Step | Model | Tokens | Cost/query |
|---|---|---|---|
| Intent Classification | gpt-4o-mini | ~600 | ~$0.00008 |
| Answer Generation | gpt-4o | ~4800 | ~$0.016 |
| **Total** | | | **~$0.016** |
| **1000 queries/month** | | | **~$16/month** |

### Memory Management

- **STM (Short-Term Memory)**: Last 10 messages in conversation context window
- **LTM (Long-Term Memory)**: Mem0 integration for cross-session user preference recall
- **Eviction**: Managed by Mem0's built-in policies (no custom logic needed)

### Consequences

- ✅ No new infrastructure (reuses existing Neo4j + ai-service)
- ✅ Zero embedding cost — saves $2-5/repo/month at scale
- ✅ Answers are grounded in deterministic graph structure, not fuzzy similarity
- ✅ Incrementally synced on every PR merge (already implemented)
- ⚠️ Cannot answer questions about code that Tree-sitter didn't parse (e.g., comments, README prose)
- ⚠️ Requires maintaining Cypher query strategies as graph schema evolves
