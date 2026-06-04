# GhostMind MCP Server

MCP (Model Context Protocol) server for GhostMind - handles character storage and answer generation with privacy-first architecture.

## Overview

The MCP server is the privacy layer of GhostMind. It:
- Stores secret characters privately (never transmitted to blockchain)
- Uses Claude/GPT to answer questions accurately
- Returns only simple responses: `ready`, `yes`, `no`, `correct`, `incorrect`
- Caches answers to ensure consistency across repeated questions

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Protocol:** MCP JSON-RPC 2.0
- **LLM:** Anthropic Claude Haiku 4 (or OpenAI GPT-4o-mini fallback)
- **Storage:** Upstash Redis (production) or in-memory (development)

## Getting Started

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env`:

```env
# Required - at least one LLM provider
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...              # Fallback if Anthropic unavailable

# Optional - production storage
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Optional - admin endpoints
ADMIN_SECRET=your-secret-key

# Optional - key namespacing (for multiple deployments)
CONTRACT_PREFIX=ghostmind-v2

# Optional - server port
PORT=3001
```

### Running

```bash
# Development
npm start

# With environment variables
ANTHROPIC_API_KEY=sk-ant-xxx npm start
```

The server runs on port 3001 by default.

### Exposing to Somnia

For Somnia's LLM Agent to reach your server, expose it publicly:

```bash
# Using ngrok
ngrok http 3001

# Note the https URL, e.g., https://abc123.ngrok.io
# Your MCP URL will be: https://abc123.ngrok.io/api/ghostmind
```

Update the smart contract's `mcpServerUrl` with this URL.

## MCP Protocol

### Endpoint

```
POST /api/ghostmind
Content-Type: application/json
```

### JSON-RPC Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "ghostmind",
    "arguments": {
      "action": "init|question|guess",
      "gameId": "123",
      ...
    }
  }
}
```

## Tool Actions

### `init` - Initialize Game

Pick a secret character and store it.

**Arguments:**
```json
{
  "action": "init",
  "gameId": "123",
  "difficulty": "easy|medium|hard"
}
```

**Response:** `"ready"`

**Character Pools:**
- **Easy (40 characters):** Einstein, Michael Jackson, Cleopatra, Shakespeare, Leonardo da Vinci, Mozart, Marilyn Monroe, Elvis Presley, Abraham Lincoln, Napoleon, etc.
- **Medium (20 characters):** Ada Lovelace, Nikola Tesla, Frida Kahlo, Alan Turing, Marie Curie, Amelia Earhart, etc.
- **Hard (12 characters):** Hypatia, Srinivasa Ramanujan, Emmy Noether, Rosalind Franklin, etc.

### `question` - Answer Yes/No Question

Answer a question about the secret character.

**Arguments:**
```json
{
  "action": "question",
  "gameId": "123",
  "question": "Was this person a scientist?"
}
```

**Response:** `"yes"` or `"no"`

**How it works:**
1. Retrieve character from storage
2. Check answer cache for this question
3. If not cached: call Claude/GPT with character context
4. Cache the answer (1-hour TTL)
5. Return normalized yes/no

### `guess` - Validate Final Guess

Check if the guess matches the character.

**Arguments:**
```json
{
  "action": "guess",
  "gameId": "123",
  "guess": "Albert Einstein"
}
```

**Response:** `"correct"` or `"incorrect"`

**Matching logic:**
- Case-insensitive comparison
- Fuzzy matching (Levenshtein distance ≤ 2)
- Handles common variations (e.g., "Einstein" matches "Albert Einstein")

## Storage

### Redis (Production)

Uses Upstash Redis with REST API:
- **TTL:** 7 days per game
- **Key format:** `{CONTRACT_PREFIX}:game:{gameId}`

### In-Memory (Development)

Falls back to in-memory Map when Redis not configured:
- Data lost on server restart
- Fine for testing and development

### Game Data Structure

```javascript
{
  character: "Albert Einstein",
  difficulty: "easy",
  questionCount: 0,
  createdAt: 1234567890
}
```

## Answer Caching

Questions are cached to ensure consistent answers:

- **Key:** `{gameId}:{normalized-question}`
- **TTL:** 1 hour
- **Normalization:** lowercase, trimmed, punctuation removed

This prevents the LLM from giving different answers to the same question asked multiple times.

## Admin Endpoints

Protected by `ADMIN_SECRET` header.

### List All Games
```
GET /admin/games
X-Admin-Secret: your-secret-key
```

### Get Game Details
```
GET /admin/game/:id
X-Admin-Secret: your-secret-key
```

### Reset All Games
```
POST /admin/reset
X-Admin-Secret: your-secret-key
```

### Health Check
```
GET /health
```

## LLM Integration

### Claude (Primary)

Uses `claude-haiku-4-5-20241022` for fast, accurate responses:

```javascript
{
  model: "claude-haiku-4-5-20241022",
  max_tokens: 10,
  system: "You are answering yes/no questions about a famous person...",
  messages: [{ role: "user", content: question }]
}
```

### OpenAI (Fallback)

Uses `gpt-4o-mini` if Anthropic unavailable:

```javascript
{
  model: "gpt-4o-mini",
  max_tokens: 10,
  messages: [
    { role: "system", content: "You are answering yes/no questions..." },
    { role: "user", content: question }
  ]
}
```

## Privacy Architecture

The server ensures character names never leak:

| What's Stored | Where | Visibility |
|---------------|-------|------------|
| Character name | MCP server only | Private |
| Game metadata | MCP server only | Private (admin only) |
| LLM prompts | MCP server → LLM API | Private |
| MCP responses | Somnia receipts | Public (but only "yes"/"no"/etc.) |

**Key principle:** The character name appears in:
- MCP server memory/Redis ✓
- LLM API calls ✓
- But NEVER in Somnia transaction data or receipts

## Error Handling

Errors return MCP-formatted error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Game not found"
  }
}
```

Common errors:
- `Game not found` - Invalid gameId
- `Missing required field` - Bad request format
- `Unknown action` - Invalid action type

## Deployment

### Requirements

- Node.js 18+
- Public HTTPS URL (for Somnia access)
- Anthropic or OpenAI API key
- (Optional) Upstash Redis for persistence

### Production Checklist

1. Set all environment variables
2. Use Redis for persistence
3. Set a strong `ADMIN_SECRET`
4. Deploy behind HTTPS (required for Somnia)
5. Update smart contract with MCP URL

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## License

MIT
