# GhostMind

**Reverse Akinator on Somnia — an on-chain guessing game powered by Somnia LLM Agents + MCP**

> Instead of an AI guessing what you're thinking, players compete to guess what famous character the AI has secretly chosen.

## Overview

GhostMind is a decentralized guessing game where a Somnia LLM Agent orchestrates gameplay while an MCP (Model Context Protocol) server acts as the trustless game master. The MCP picks a secret character and answers questions, while the character name **never appears in any public receipt**.

**Key Innovation:** Privacy-first architecture using MCP. The character is stored privately in the MCP server and never transmitted to Somnia. An external LLM (Claude/GPT) handles question answering with perfect consistency and factual accuracy.

## How It Works

```
1. Game Master creates a round → Seeds prize pool + LLM picks secret character
2. Players ask yes/no questions → Each question grows the pot
3. Players attempt guesses → Wrong guesses grow the pot
4. Correct guess → Winner takes pot minus 3% protocol fee
```

### Game Flow

| Action | Cost | Result |
|--------|------|--------|
| Create Game | 0.24 STT + prize pool | inferChat: hash-hex pick → responds `ready` (name not on-chain) |
| Ask Question | 0.24 STT + game fee | LLM answers "yes" or "no" |
| Correct Guess | 0.24 STT (game fee refunded) | Winner receives pot - 3% fee |
| Wrong Guess | 0.24 STT + game fee | Fee added to pot |

### Difficulty Levels

- **Easy** — Very famous people everyone knows (celebrities, world leaders)
- **Medium** — Moderately famous, known in their field
- **Hard** — Obscure or lesser-known figures

## Architecture

### The Privacy Problem

Traditional blockchain games struggle with secrets because everything on-chain is public. After extensive research (see `RESEARCH_FINDINGS.md`), we found that:

1. **Somnia LLM doesn't maintain consistency** — Character drifts across calls
2. **MCP tool calls are public** — Both requests and responses appear in receipts
3. **The Impossible Triangle** — Can't have Privacy + Somnia Reasoning + Consistency

### Our Solution: MCP Privacy Architecture

GhostMind uses a hybrid approach where:
- **MCP Server** stores the character privately and uses Claude/GPT for accurate answers
- **Somnia LLM** orchestrates the game flow by calling MCP tools
- **Only simple responses** are returned: "ready", "yes", "no", "correct", "incorrect"

```
┌─────────────────────────────────────────────────────────────┐
│                    GhostMindV2.sol                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Game State  │  │ Q&A History │  │ Chat History        │  │
│  │ (phase,pot) │  │ (frontend)  │  │ (roles[], messages[])│  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│          ┌────────────────────────────────┐                  │
│          │ inferToolsChat(roles, msgs,    │                  │
│          │                mcpServerUrl)   │                  │
│          └────────────────────────────────┘                  │
│                           │                                  │
└───────────────────────────┼─────────────────────────────────┘
                            ▼
              ┌────────────────────────┐
              │  Somnia Agent Platform │
              │  (3-agent subcommittee)│
              └────────────────────────┘
                            │
                            ▼
              ┌────────────────────────┐
              │   LLM Inference Agent  │ ──────► MCP Server
              │     (Qwen3-30B)        │         (ghostmind tool)
              └────────────────────────┘              │
                                                      ▼
                                          ┌────────────────────┐
                                          │  Character Storage │
                                          │  + Claude/GPT LLM  │
                                          │  (PRIVATE)         │
                                          └────────────────────┘
```

### What's Public vs Private

| Public (in receipts) | Private (MCP server only) |
|---------------------|---------------------------|
| Tool call: action, gameId | Character name |
| Questions asked | Character selection logic |
| Responses: yes/no/correct/incorrect | External LLM reasoning |

### Smart Contract

**GhostMindV2.sol** — 656 lines of Solidity

- **Game Phases:** `NonExistent → Initializing → Active → Processing → Finished`
- **Request Types:** `Init`, `Question`, `Guess`
- **Callbacks:** Platform calls back with LLM responses
- **Recovery:** 30-minute timeout with `resetStuckGame()`

### Events

```solidity
GameCreated(gameId, gameMaster, pot, gameFee, difficulty)
GameReady(gameId)
QuestionAsked(gameId, player, question, newPot)
QuestionAnswered(gameId, question, answer, questionCount)
GuessAttempted(gameId, player, guess, newPot)
GuessResult(gameId, player, guess, correct)
GameWon(gameId, winner, guess, prize)
GameEnded(gameId, recipient, amount, reason)
```

## Tech Stack

### Smart Contracts
- Solidity 0.8.20
- Somnia Agent Platform integration
- `inferToolsChat` for MCP tool calling

### MCP Server
- Node.js + Express
- MCP JSON-RPC 2.0 protocol
- External LLM (Claude Haiku or GPT-4o-mini)
- Privacy-first: character never in responses

### Frontend
- Next.js 16 / React 19
- TypeScript + Tailwind CSS
- Viem + Wagmi for blockchain interactions
- RainbowKit wallet connection
- TanStack Query for data fetching

## Somnia Integration

### Network

| Property | Testnet | Mainnet |
|----------|---------|---------|
| Chain ID | 50312 | 5031 |
| Currency | STT | SOMI |
| RPC | `https://api.infra.testnet.somnia.network` | `https://api.infra.mainnet.somnia.network` |
| Platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` | `0x5E5205CF39E766118C01636bED000A54D93163E6` |

### LLM Agent

| Property | Value |
|----------|-------|
| Agent ID | `12847293847561029384` |
| Method | `inferToolsChat` |
| MCP Tool | `ghostmind` |
| Deposit | 0.24 STT per call |

### Public Receipts

All LLM calls produce public execution receipts:
```
https://agents.testnet.somnia.network/receipts/<requestId>
```

**What's public:** Questions, answers, wrong guesses
**What's private:** The character name (never in prompts or storage)

## Project Structure

```
ghostmind-somnia/
├── contracts/
│   └── GhostMindV2.sol          # Core game contract (inferToolsChat + MCP)
├── mcp-server/
│   ├── server.mjs               # MCP server (privacy-first, JSON-RPC)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js pages
│   │   ├── components/          # React components
│   │   ├── hooks/               # Custom game logic hooks
│   │   └── lib/                 # Utilities, ABI, config
│   └── package.json
├── test-e2e-mcp.mjs             # End-to-end test script
├── play-mcp-game.mjs            # Interactive CLI game
├── RESEARCH_FINDINGS.md         # Architecture research docs
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- A wallet with STT (get from [testnet faucet](https://testnet.somnia.network/))
- Anthropic API key (or OpenAI API key) for MCP server

### 1. Start MCP Server

```bash
cd mcp-server
npm install

# Start with Anthropic (recommended)
ANTHROPIC_API_KEY=sk-ant-... npm start

# Or with OpenAI
OPENAI_API_KEY=sk-... npm start
```

### 2. Expose MCP Server (for Somnia access)

```bash
# In another terminal
ngrok http 3001

# Note the https URL (e.g., https://abc123.ngrok.io)
```

### 3. Deploy Contract

```bash
# Using your preferred deployment tool (Hardhat, Foundry, etc.)
# Deploy GhostMindV2.sol with:
#   - feeRecipient address
#   - mcpServerUrl (your ngrok URL + /api/ghostmind)
```

### 4. Play the Game

```bash
# Interactive CLI
PRIVATE_KEY=0x... MCP_URL=https://your-ngrok-url/api/ghostmind node play-mcp-game.mjs

# Or run E2E test
PRIVATE_KEY=0x... MCP_URL=https://your-ngrok-url/api/ghostmind node test-e2e-mcp.mjs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Game Economics

| Parameter | Value |
|-----------|-------|
| LLM Deposit | 0.24 STT |
| Protocol Fee | 3% of winning pot |
| Timeout | 30 minutes (stuck recovery) |

**Self-funding prize pools:** Every question and wrong guess grows the pot, creating natural engagement incentives.

## Why GhostMind is Novel

1. **MCP Privacy Architecture** — Character stored privately in MCP server, never transmitted to blockchain or appearing in receipts.

2. **Hybrid LLM Design** — Somnia LLM orchestrates, external LLM (Claude/GPT) reasons. Best of both worlds.

3. **Transparent Yet Private** — All game interactions are publicly auditable, but the character name never appears anywhere.

4. **Accurate Factual Answers** — Using Claude/GPT ensures correct answers about historical figures' nationality, profession, etc.

5. **Consensus-Validated Flow** — 3-agent subcommittee validates every MCP tool call for tamper-proof gameplay.

6. **Simple Response Protocol** — Only "ready", "yes", "no", "correct", "incorrect" ever returned, minimizing information leakage.

## Links

- [Somnia Testnet Faucet](https://testnet.somnia.network/)
- [Somnia Agents (Testnet)](https://agents.testnet.somnia.network)
- [Somnia Docs](https://docs.somnia.network/agents)
- [LLM Inference Agent](https://agents.testnet.somnia.network/agent/12847293847561029384)

## License

MIT
