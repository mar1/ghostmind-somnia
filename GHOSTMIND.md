# GhostMind — Project Documentation

> Reverse Akinator on Somnia — on-chain guessing game powered by Somnia LLM Agents

**Canonical contract:** `GhostMindV2.sol` (history-based architecture)

---

## Concept

A game master deploys a round and seeds a prize pool. At init, the Somnia LLM Agent picks a character via **`hash-hex-name`** (`keccak256("GhostMind.v1", gameId)` → 8 hex chars) and responds **`ready`** only. The contract stores **`ready`** in chat history, not the name. Anyone can ask yes/no questions or guess; every turn replays full **`inferChat`** history.

**Key innovation:** Roster-free seed in the init prompt; **consistency within a game** comes from **`inferChat` history** on-chain.

**Pitch line:** The contract is the public memory of the game; the Somnia agent is the game master that must stay consistent with that memory.

---

## Architecture (V2 — inferChat + hash-hex-name)

### Character seed

`HEX = first 8 hex chars of keccak256("GhostMind.v1", gameId)` — computed on-chain in `createGame`. Init asks the model to pick from HEX and reply **`ready`** only; on-chain `chatMessages` stores **`ready`** (raw Somnia receipt may still show more).

Within one game, Q&A uses **`inferChat`** with full `chatRoles` / `chatMessages` replayed each call.

### Flow

```
createGame(gameFee)
  → GM pays LLM_DEPOSIT (0.24) + prizePool → pot
  → inferChat init: GAME_ID + HEX → LLM responds "ready" (name not stored on-chain)
  → phase = Active

askQuestion(gameId, "Is this person French?")
  → player pays LLM_DEPOSIT + gameFee (gameFee → pot)
  → inferChat with full chat history + question
  → LLM answers "yes" or "no"
  → stored in history[], emitted on-chain

finalGuess(gameId, "Napoleon Bonaparte")
  → player pays LLM_DEPOSIT + gameFee (held; refunded if correct)
  → prompt = full history[] + guess
  → LLM answers "correct" or "incorrect" (allowedValues)
  → correct: gameFee refunded, player wins pot − 3% protocol fee
  → incorrect: gameFee → pot, guess recorded as GUESS: … / incorrect in history
```

### Stateless LLM, stateful contract

The agent uses `inferString` only (not `inferChat`). Each platform call is stateless for validators, but the contract **reconstructs multi-turn context** by pasting `history[]` into the prompt. This matches Somnia callbacks and consensus constraints without managing conversation state off-chain.

### Economics

| Action | Cost | Destination |
|--------|------|-------------|
| `createGame()` | `LLM_DEPOSIT` + prizePool | LLM → validators; remainder → pot |
| `askQuestion()` | `LLM_DEPOSIT` + gameFee | LLM → validators; gameFee → pot |
| `finalGuess()` correct | `LLM_DEPOSIT` + gameFee | LLM → validators; **gameFee refunded**; winner gets pot − 3% |
| `finalGuess()` incorrect | `LLM_DEPOSIT` + gameFee | LLM → validators; gameFee → pot |

### Key design decisions

- **No lobby** — GM creates and launches immediately; anyone can play
- **No elimination** — wrong guesses cost fees but do not ban players
- **History as source of truth** — no `keccak256` name check; guesses validated by LLM with full context
- **On-chain transparency** — all questions, answers, and wrong guesses are in `history[]` and events
- **Prize pool self-funds** — questions and failed guesses grow the pot; GM seeds initially
- **3% protocol fee** on winning
- **Max 20 questions** — then pot refunds to GM (`GameEnded`)

---

## Somnia Network

### Network Info

| Property | Mainnet | Testnet |
|----------|---------|---------|
| Chain ID | `5031` | `50312` |
| RPC URL | `https://api.infra.mainnet.somnia.network` | `https://api.infra.testnet.somnia.network` |
| Currency | SOMI | STT |
| SomniaAgents Contract | `0x5E5205CF39E766118C01636bED000A54D93163E6` | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` |
| AgentRegistry | `0xaD3101C37F091593fEe7cb471e92b5E9A1205194` | `0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A` |

### Testnet Faucet

https://testnet.somnia.network/

---

## Somnia Agents

### Available Agents

| Agent | ID | Methods | Deposit |
|-------|-----|---------|---------|
| LLM Inference | `12847293847561029384` | inferString, inferNumber, inferChat, inferToolsChat | 0.24 SOMI |
| LLM Parse Website | `12875401142070969085` | 2 methods | - |
| JSON API Request | `13174292974160097713` | 6 methods | 0.12 SOMI |

### LLM Inference Agent — Exact Signatures

```solidity
function inferString(
    string prompt,
    string system,
    bool chainOfThought,
    string[] allowedValues
) returns (string response)

function inferNumber(
    string prompt,
    string system,
    int256 minValue,
    int256 maxValue,
    bool chainOfThought
) returns (int256 response)

function inferChat(
    string[] roles,
    string[] messages,
    bool chainOfThought
) returns (string response)

function inferToolsChat(
    string[] roles,
    string[] messages,
    string[] mcpServerUrls,
    tuple[] onchainTools,
    uint256 maxIterations,
    bool chainOfThought
) returns (...)
```

### Gas Fees

| Agent Type | Per-Agent Price | Subcommittee (3) | Total deposit |
|-----------|----------------|-------------------|---------------|
| JSON API | 0.03 SOMI | 0.09 SOMI | 0.12 SOMI |
| LLM Inference | 0.07 SOMI | 0.21 SOMI | 0.24 SOMI |
| LLM Parse Website | 0.10 SOMI | 0.30 SOMI | 0.33 SOMI |

Formula: `msg.value = (MIN_PER_AGENT + LLM_PER_AGENT) × SUBCOMMITTEE_SIZE` = `(0.01 + 0.07) × 3 = 0.24 SOMI`

### Platform Interface (Solidity)

```solidity
interface IAgentRequester {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);
}

function handleResponse(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory details
) external;
```

### Invoking from Solidity — Example Pattern

```solidity
bytes memory payload = abi.encodeWithSelector(
    ILLMInferenceAgent.inferString.selector,
    prompt,
    SYSTEM_PROMPT,
    false,
    allowedValues
);

uint256 requestId = PLATFORM.createRequest{value: LLM_DEPOSIT}(
    LLM_AGENT_ID,
    address(this),
    this.handleQuestionResponse.selector,
    payload
);
```

### Receipts

Every agent invocation produces a public execution receipt.

```
https://receipts.testnet.agents.somnia.host/agent-receipts?requestId=<id>&contractAddress=<platform>&type=minimal
https://agents.testnet.somnia.network/receipts/<requestId>
```

**⚠️ CRITICAL:** Both `prompt` and `system` are visible in receipts and in decodable `RequestCreated` payloads.

**What stays secret:** The character **name** is never written on-chain or in prompts.

**What is public:** Player questions, yes/no answers, failed guesses (in `history[]` and receipts). Players can infer the character from Q&A — that is the game.

---

## The Secret Problem & V2 Solution

### The problem

Anything passed to the LLM is public (events, receipts). You cannot hide a string in the `system` prompt.

### V1 approach (deprecated) — seed determinism

Re-derive character from `gameId` on every call without storing the name. **Does not work reliably** with Qwen3-30B across independent requests.

### V2 approach (current) — hash-hex-name + inferChat history

| Concern | How V2 handles it |
|---------|-------------------|
| Character pick | `HEX` from `keccak256("GhostMind.v1", gameId)` in init prompt |
| Name on-chain | Not in storage; first assistant message is full name (in chat arrays / receipts) |
| Cross-call consistency | `inferChat` replays `chatRoles` / `chatMessages` each turn |
| Guess validation | LLM sees history + guess → `correct` / `incorrect` |
| Wrong guess context | Appended as `GUESS: {name}` / `incorrect` in history |

### Remaining risks (honest)

- LLM may contradict earlier answers (mitigated by history, not provable)
- Same `gameId` may pick different celebrities across separate games (hash-hex is a hint, not a proof)
- Factual yes/no errors still possible
- Each action costs full `LLM_DEPOSIT` (0.24)

### Future fallback (if consistency fails in production)

Hybrid: off-chain GM + `secretHash` + signed answers. Loses pure on-chain GM; keep as backup narrative only.

---

## Smart Contract — GhostMindV2

**File:** `GhostMindV2.sol` (testnet platform address baked in; swap for mainnet deploy)

### Key constants

```solidity
IAgentRequester public constant PLATFORM =
    IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776); // Testnet

uint256 public constant LLM_AGENT_ID = 12847293847561029384;
uint256 public constant LLM_DEPOSIT  = 0.24 ether;
uint256 public constant MAX_QUESTIONS = 20;
uint256 public constant PROTOCOL_FEE_BPS = 300; // 3%
```

### Game phases

```solidity
enum GamePhase {
    NonExistent,   // 0
    Initializing,  // 1 — waiting for LLM init
    Active,        // 2 — open for questions/guesses
    Processing,    // 3 — waiting for LLM response
    Finished       // 4 — winner or ended
}
```

### Public functions

```solidity
function createGame(uint256 gameFee) external payable returns (uint256 gameId)
function askQuestion(uint256 gameId, string calldata question) external payable
function finalGuess(uint256 gameId, string calldata guess) external payable
function resetStuckGame(uint256 gameId) external  // after 30 min in Processing

function getGame(uint256 gameId) external view returns (...)
function getHistory(uint256 gameId) external view returns (QA[] memory)
function getChatHistory(uint256 gameId) external view returns (string[] roles, string[] messages)
function getActionCost(uint256 gameId) external view returns (uint256 questionCost, uint256 guessCost)
// Both costs = LLM_DEPOSIT + gameFee
```

### Callbacks (platform only)

```solidity
function handleInitResponse(...) external
function handleQuestionResponse(...) external
function handleGuessResponse(...) external
```

### inferChat (all turns)

**System:** deterministic pick rules + stay on character + yes/no + guess format.

**Init user message:**
```
GAME_ID = {gameId}
HEX = {hex8}

TASK: Map HEX to a famous real person. Commit mentally. Do NOT write their name. Reply exactly: ready
```

**On-chain assistant message after init:** always `ready` (contract does not store the raw name).

**Question user message:** `QUESTION: {q}\n\nAnswer with ONLY "yes" or "no". Stay consistent with prior answers.`

**Guess user message:** `My guess is: {name}. Answer with exactly 'correct' or 'incorrect'.`

---

## Test Scripts

### Primary (V2 flow)

```bash
npm install
export PRIVATE_KEY=0x...
export CONTRACT=0x48d6c7b4b69665524372686dF984e3f7Ee243952

npm run cli -- create --pot 2.4 --fee 0.18
npm run cli -- wait 1
npm run cli -- ask 1 "Is this person male?"
npm run cli -- guess 1 "Albert Einstein"
npm run cli -- demo
```

### Legacy / research

```bash
# Seed determinism — expected to fail or be inconsistent; documents why V2 exists
PRIVATE_KEY=0x... node test-determinism.mjs
PRIVATE_KEY=0x... node test-determinism-v2.mjs

# V1-style seed + guess without contract history
PRIVATE_KEY=0x... SEED=42 node test-guess.mjs

# Debug receipts / events
node debug-receipt.mjs
node debug-events.mjs
```

Approximate cost: **0.24 STT per LLM call** (init + each question + each guess).

---

## Known Issues & TODOs

### Product / demo

- [ ] Frontend / UI
- [ ] Deploy `GhostMindV2` to testnet and run full flow (create → 2 questions → guess → win)
- [ ] Record demo with receipt links for judges

### Contract

- [x] `resetStuckGame` timeout — 30 min guard in V2
- [ ] Mainnet `PLATFORM` address when deploying to mainnet
- [ ] Gas / prompt size if `history[]` grows large (20 Q&A + guesses)

### LLM / ops

- [ ] Monitor inconsistent yes/no vs guess outcomes in test games
- [ ] Receipt polling helpers — verify JSON path matches `agent-receipts` API

### Deprecated (V1 — do not pitch)

- `AkinatorReverseOpenWorld.sol` — seed + local `keccak256` guess
- Hybrid backend signing — fallback only

---

## Off-Chain Reactivity (frontend)

```typescript
import { SDK } from '@somnia-chain/reactivity';

const sdk = new SDK({ public: createPublicClient({ chain, transport: webSocket() }) });

const subscription = await sdk.watch({
  eventContractSources: [CONTRACT_ADDRESS],
  ethCalls: [],
  onData: (data) => { /* handle events */ },
});
```

**Events (V2):**

- `GameCreated(gameId, gameMaster, pot, gameFee)`
- `GameReady(gameId)`
- `QuestionAsked(gameId, player, question, newPot)`
- `QuestionAnswered(gameId, question, answer, questionCount)`
- `GuessAttempted(gameId, player, guess, newPot)`
- `GuessResult(gameId, player, guess, correct)`
- `GameWon(gameId, winner, guess, prize)`
- `GameEnded(gameId, recipient, amount, reason)` — max questions, no winner
- `RequestFailed(gameId, requestId, status)`

---

## Files

```
contracts/GhostMindV2.sol    — Canonical contract (inferChat + hash-hex-name)
test-consistency.mjs         — Manual inferChat consistency experiments
GHOSTMIND.md                 — This file
RESEARCH_FINDINGS.md         — Architecture research notes
```

---

## Useful Links

- Agents web app (testnet): https://agents.testnet.somnia.network
- Agents web app (mainnet): https://agents.somnia.network
- Explorer (testnet): https://shannon-explorer.somnia.network
- Docs: https://docs.somnia.network/agents
- LLM Inference agent: https://agents.testnet.somnia.network/agent/12847293847561029384
- Faucet: https://testnet.somnia.network/
