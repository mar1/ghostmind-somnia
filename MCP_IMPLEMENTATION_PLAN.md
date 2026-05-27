# GhostMind MCP Implementation Plan

## Problem Statement

The current implementation has a critical flaw: the LLM doesn't maintain consistent memory of the chosen character across questions. This leads to:
- Inconsistent answers (e.g., saying someone is NOT from Tibet when they are)
- Rejected correct guesses (e.g., "dalai lama" rejected for Tenzin Gyatso)
- Factually incorrect responses

## Solution: MCP Server as Secret Keeper

Use Somnia's MCP (Model Context Protocol) integration to privately remind the LLM of the character on each call. MCP responses are **internal to the LLM agent** and do NOT appear in public receipts.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Smart Contract │────▶│  Somnia Platform │────▶│   MCP Server    │
│   (on-chain)    │     │   (validators)   │     │ (our server)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                        │
                        Public receipt            Private DB
                        - question                - character name
                        - "yes"/"no"              - game state
```

## Architecture Overview

### What's Public (on-chain / receipts)
- Player questions
- LLM answers (yes/no/correct/incorrect)
- Game state (pot, phase, etc.)

### What's Private (MCP only)
- Character name
- MCP request/response content

---

## Part 1: MCP Server Implementation

### Tech Stack
- Runtime: Node.js or Python
- Framework: Express.js / FastAPI
- Database: SQLite (simple) or Redis (if scaling needed)
- Hosting: Vercel, Railway, or any VPS

### Endpoint Specification

Single endpoint handling all game actions:

```
POST https://your-server.com/api/ghostmind
Content-Type: application/json
```

#### Action: `init`

Called when a new game starts. Picks and stores a character.

**Request:**
```json
{
  "action": "init",
  "gameId": "123",
  "difficulty": "easy"
}
```

**Response:**
```json
{
  "message": "You have chosen Albert Einstein as your secret character. Remember this person for all questions. Respond with exactly: ready"
}
```

**Server Logic:**
1. Pick random character from difficulty-appropriate list
2. Store in DB: `gameId → characterName`
3. Return message that commits the LLM to this character

#### Action: `question`

Called for each yes/no question.

**Request:**
```json
{
  "action": "question",
  "gameId": "123",
  "question": "Is this person German?"
}
```

**Response:**
```json
{
  "message": "Your secret character is Albert Einstein. The player asks: 'Is this person German?' Based on true facts about Albert Einstein, answer with exactly 'yes' or 'no'."
}
```

**Server Logic:**
1. Lookup character from DB using gameId
2. Return prompt that reminds LLM of the character
3. LLM uses its own knowledge to answer

#### Action: `guess`

Called when a player makes a guess.

**Request:**
```json
{
  "action": "guess",
  "gameId": "123",
  "guess": "Einstein"
}
```

**Response:**
```json
{
  "message": "The player guessed 'Einstein'. Your character is 'Albert Einstein'. This is CORRECT. Respond with exactly: correct"
}
```

**Server Logic:**
1. Lookup character from DB
2. Normalize both strings (lowercase, trim, handle variations)
3. Compare and tell LLM the result
4. LLM just confirms with "correct" or "incorrect"

### Character Lists by Difficulty

```javascript
const CHARACTERS = {
  easy: [
    "Albert Einstein",
    "Michael Jackson",
    "Queen Elizabeth II",
    "Leonardo da Vinci",
    "Cleopatra",
    "Napoleon Bonaparte",
    "Marilyn Monroe",
    "Elvis Presley",
    "William Shakespeare",
    "Abraham Lincoln",
    // ... 50+ very famous people
  ],
  medium: [
    "Ada Lovelace",
    "Nikola Tesla",
    "Frida Kahlo",
    // ... moderately famous
  ],
  hard: [
    "Hypatia",
    "Ramanujan",
    // ... obscure figures
  ]
};
```

### Name Normalization

For guess comparison, normalize names:

```javascript
function normalize(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ');       // collapse whitespace
}

function isMatch(guess, character) {
  const g = normalize(guess);
  const c = normalize(character);

  // Exact match
  if (g === c) return true;

  // Last name match (e.g., "Einstein" matches "Albert Einstein")
  if (c.endsWith(g) || c.startsWith(g)) return true;

  // Handle common variations
  const variations = getVariations(character); // e.g., "Dalai Lama" for "Tenzin Gyatso"
  return variations.some(v => normalize(v) === g);
}
```

### Sample MCP Server (Node.js)

```javascript
import express from 'express';
import Database from 'better-sqlite3';

const app = express();
app.use(express.json());

const db = new Database('ghostmind.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    game_id TEXT PRIMARY KEY,
    character TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const CHARACTERS = {
  easy: ["Albert Einstein", "Michael Jackson", ...],
  medium: [...],
  hard: [...]
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalize(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

app.post('/api/ghostmind', (req, res) => {
  const { action, gameId, difficulty, question, guess } = req.body;

  if (action === 'init') {
    const character = pickRandom(CHARACTERS[difficulty] || CHARACTERS.easy);
    db.prepare('INSERT OR REPLACE INTO games (game_id, character) VALUES (?, ?)')
      .run(gameId, character);

    return res.json({
      message: `You have chosen "${character}" as your secret character. Remember this person for the entire game. Respond with exactly: ready`
    });
  }

  if (action === 'question') {
    const row = db.prepare('SELECT character FROM games WHERE game_id = ?').get(gameId);
    if (!row) return res.status(404).json({ error: 'Game not found' });

    return res.json({
      message: `Your secret character is "${row.character}". The player asks: "${question}". Based on TRUE historical facts about ${row.character}, answer with exactly "yes" or "no".`
    });
  }

  if (action === 'guess') {
    const row = db.prepare('SELECT character FROM games WHERE game_id = ?').get(gameId);
    if (!row) return res.status(404).json({ error: 'Game not found' });

    const isCorrect = normalize(guess) === normalize(row.character) ||
                      normalize(row.character).includes(normalize(guess));

    return res.json({
      message: `The player guessed "${guess}". Your character is "${row.character}". This is ${isCorrect ? 'CORRECT' : 'INCORRECT'}. Respond with exactly: ${isCorrect ? 'correct' : 'incorrect'}`
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
});

app.listen(3001, () => console.log('MCP server running on :3001'));
```

---

## Part 2: Smart Contract Changes

### Using inferToolsChat with MCP

Reference: https://docs.somnia.network/agents/base-agents/llm-inference

The contract must use `inferToolsChat` instead of `inferChat`:

```solidity
interface ILLMInferenceAgent {
    struct OnchainTool {
        string signature;
        string description;
    }

    function inferToolsChat(
        string[] calldata roles,
        string[] calldata messages,
        string[] calldata mcpServerUrls,  // MCP servers
        OnchainTool[] calldata onchainTools,
        uint256 maxIterations,
        bool chainOfThought
    ) external returns (
        string memory finishReason,
        string memory response,
        string[] memory updatedRoles,
        string[] memory updatedMessages,
        string[] memory pendingToolCallIds,
        bytes[] memory pendingToolCalls
    );
}
```

### Key Parameters

- `mcpServerUrls`: Array containing our MCP server URL
- `onchainTools`: Empty array (we're not using on-chain tools)
- `maxIterations`: Set to 2-3 (MCP call + response)
- `chainOfThought`: false (keep reasoning private)

### Contract Modifications

#### 1. Add MCP Server URL constant

```solidity
string private constant MCP_SERVER = "https://your-server.com/api/ghostmind";
```

#### 2. Modify createGame to use inferToolsChat

```solidity
function createGame(uint256 gameFee, Difficulty difficulty) external payable returns (uint256 gameId) {
    // ... existing setup code ...

    // Initialize chat
    g.chatRoles.push("system");
    g.chatMessages.push(SYSTEM_PROMPT);

    g.chatRoles.push("user");
    g.chatMessages.push(string(abi.encodePacked(
        'Call the ghostmind tool with action "init", gameId "',
        _uint2str(gameId),
        '", and difficulty "',
        _difficultyString(difficulty),
        '".'
    )));

    // MCP server URLs
    string[] memory mcpServers = new string[](1);
    mcpServers[0] = MCP_SERVER;

    // No on-chain tools needed
    ILLMInferenceAgent.OnchainTool[] memory onchainTools;

    bytes memory payload = abi.encodeWithSelector(
        ILLMInferenceAgent.inferToolsChat.selector,
        g.chatRoles,
        g.chatMessages,
        mcpServers,
        onchainTools,
        3,     // maxIterations
        false  // chainOfThought
    );

    // ... rest of function ...
}
```

#### 3. Modify askQuestion to use MCP

```solidity
function askQuestion(uint256 gameId, string calldata question) external payable {
    // ... existing setup code ...

    g.chatRoles.push("user");
    g.chatMessages.push(string(abi.encodePacked(
        'Call the ghostmind tool with action "question", gameId "',
        _uint2str(gameId),
        '", and question "',
        question,
        '".'
    )));

    string[] memory mcpServers = new string[](1);
    mcpServers[0] = MCP_SERVER;

    ILLMInferenceAgent.OnchainTool[] memory onchainTools;

    bytes memory payload = abi.encodeWithSelector(
        ILLMInferenceAgent.inferToolsChat.selector,
        g.chatRoles,
        g.chatMessages,
        mcpServers,
        onchainTools,
        3,
        false
    );

    // ... rest of function ...
}
```

#### 4. Modify finalGuess to use MCP

```solidity
function finalGuess(uint256 gameId, string calldata guess) external payable {
    // ... existing setup code ...

    g.chatRoles.push("user");
    g.chatMessages.push(string(abi.encodePacked(
        'Call the ghostmind tool with action "guess", gameId "',
        _uint2str(gameId),
        '", and guess "',
        guess,
        '".'
    )));

    string[] memory mcpServers = new string[](1);
    mcpServers[0] = MCP_SERVER;

    ILLMInferenceAgent.OnchainTool[] memory onchainTools;

    bytes memory payload = abi.encodeWithSelector(
        ILLMInferenceAgent.inferToolsChat.selector,
        g.chatRoles,
        g.chatMessages,
        mcpServers,
        onchainTools,
        3,
        false
    );

    // ... rest of function ...
}
```

#### 5. Update System Prompt

```solidity
string private constant SYSTEM_PROMPT =
    "You are the game master of a Guess Who guessing game. "
    "You MUST use the ghostmind MCP tool for ALL actions. "
    "The tool will tell you which character you picked and how to answer. "
    "ALWAYS follow the tool's instructions exactly. "
    "Your responses must be exactly: 'ready', 'yes', 'no', 'correct', or 'incorrect'. "
    "Never add extra text.";
```

---

## Part 3: Testing Plan

### 1. Test MCP Server Locally

```bash
# Start server
node mcp-server.js

# Test init
curl -X POST http://localhost:3001/api/ghostmind \
  -H "Content-Type: application/json" \
  -d '{"action":"init","gameId":"test1","difficulty":"easy"}'

# Test question
curl -X POST http://localhost:3001/api/ghostmind \
  -H "Content-Type: application/json" \
  -d '{"action":"question","gameId":"test1","question":"Is this person a scientist?"}'

# Test guess
curl -X POST http://localhost:3001/api/ghostmind \
  -H "Content-Type: application/json" \
  -d '{"action":"guess","gameId":"test1","guess":"Einstein"}'
```

### 2. Test with Somnia Testnet

Create a test script similar to `old/test-inferchat-memory.mjs` but using `inferToolsChat` with the MCP server URL.

### 3. Verify Privacy

After a successful game:
1. Fetch the receipt from Somnia
2. Verify the character name does NOT appear anywhere
3. Only "yes"/"no"/"correct"/"incorrect" should be visible

---

## Part 4: Deployment Checklist

### MCP Server
- [ ] Deploy to production (Vercel/Railway/VPS)
- [ ] Set up HTTPS (required for Somnia)
- [ ] Configure CORS if needed
- [ ] Set up monitoring/logging
- [ ] Populate character lists for all difficulties

### Smart Contract
- [ ] Update ILLMInferenceAgent interface with inferToolsChat
- [ ] Add MCP_SERVER constant with production URL
- [ ] Modify createGame, askQuestion, finalGuess
- [ ] Update system prompt
- [ ] Deploy to Somnia testnet
- [ ] Test full game flow
- [ ] Deploy to mainnet

### Frontend
- [ ] No changes needed (uses same contract interface)
- [ ] Optionally add "powered by MCP" indicator

---

## Summary

| Aspect | Before (inferChat) | After (MCP) |
|--------|-------------------|-------------|
| Character memory | LLM forgets/inconsistent | MCP reminds every call |
| Answer accuracy | Random/wrong | Based on LLM knowledge + correct character |
| Guess verification | LLM-based (unreliable) | MCP comparison (exact) |
| Character privacy | Never truly private | Private in MCP DB |
| Infrastructure | Contract only | Contract + MCP server |

## References

- Somnia LLM Inference Docs: https://docs.somnia.network/agents/base-agents/llm-inference
- MCP Protocol: https://modelcontextprotocol.io/
- Current Contract: `/contracts/GhostMindV2.sol`
- Test Scripts: `/old/test-*.mjs`
