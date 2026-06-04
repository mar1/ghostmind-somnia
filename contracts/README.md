# GhostMind Smart Contract

Solidity smart contract for GhostMind - an on-chain guessing game powered by Somnia LLM Agents.

## Contract: GhostMindV2

**Deployed:** `0x6291d4912cf13C67bbfdfDfF42fE941970E94326` (Somnia Testnet)

## Overview

GhostMindV2 orchestrates a guessing game where players try to identify a secret character chosen by an AI Oracle. The contract integrates with Somnia's LLM Agent Platform using `inferToolsChat` to call an MCP server that stores the character privately.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GhostMindV2.sol                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Game State  │  │ Q&A History │  │ Chat History        │ │
│  │ (phase,pot) │  │ (frontend)  │  │ (roles[], messages[])│ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                           │                                 │
│                           ▼                                 │
│           ┌────────────────────────────────┐                │
│           │ PLATFORM.createAdvancedRequest │                │
│           │   → inferToolsChat(mcpUrl)     │                │
│           └────────────────────────────────┘                │
└───────────────────────────┼─────────────────────────────────┘
                            ▼
              ┌────────────────────────┐
              │  Somnia Agent Platform │
              │  (validator consensus) │
              └────────────────────────┘
                            │
                            ▼
              ┌────────────────────────┐
              │   LLM Inference Agent  │ ──► MCP Server
              │     (ghostmind tool)   │     (character storage)
              └────────────────────────┘
```

## Constants

```solidity
PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776  // Somnia testnet
LLM_AGENT_ID = 12847293847561029384                     // LLM Inference Agent
LLM_DEPOSIT = 0.24 ether                                // Cost per LLM call
PROTOCOL_FEE_BPS = 300                                  // 3% protocol fee
```

## Game Phases

```solidity
enum GamePhase {
    NonExistent,   // 0 - Game doesn't exist
    Initializing,  // 1 - Waiting for LLM to pick character
    Active,        // 2 - Open for questions/guesses
    Processing,    // 3 - Waiting for LLM response
    Finished       // 4 - Game ended (winner or timeout)
}
```

## Difficulty Levels

```solidity
enum Difficulty {
    Easy,    // 0 - Very famous people (celebrities, world leaders)
    Medium,  // 1 - Moderately famous (known in their field)
    Hard     // 2 - Obscure historical figures
}
```

## Core Functions

### Create Game
```solidity
function createGame(uint256 gameFee, Difficulty difficulty)
    external payable
    returns (uint256 gameId)
```
- **Cost:** `msg.value >= LLM_DEPOSIT` (additional value becomes prize pool)
- **Flow:** Creates game → Calls LLM to pick character → Waits for "ready" response
- **Emits:** `GameCreated`, then `GameReady` on callback

### Ask Question
```solidity
function askQuestion(uint256 gameId, string calldata question)
    external payable
```
- **Cost:** `LLM_DEPOSIT + gameFee`
- **Flow:** Adds fee to pot → Calls LLM with question → Stores yes/no answer
- **Emits:** `QuestionAsked`, then `QuestionAnswered` on callback

### Final Guess
```solidity
function finalGuess(uint256 gameId, string calldata guess)
    external payable
```
- **Cost:** `LLM_DEPOSIT + gameFee`
- **Flow:** Calls LLM to validate guess → If correct: refund fee, pay winner; If wrong: add fee to pot
- **Emits:** `GuessAttempted`, then `GuessResult`, and `GameWon` if correct

### Recovery
```solidity
function resetStuckGame(uint256 gameId) external
```
- **Condition:** Game stuck in Processing for 30+ minutes
- **Flow:** Resets to Active phase, refunds pending player's fee

## View Functions

```solidity
// Get game state
function getGame(uint256 gameId) external view returns (
    address gameMaster,
    GamePhase phase,
    Difficulty difficulty,
    uint256 gameFee,
    uint256 pot,
    uint256 questionCount,
    address winner
)

// Get Q&A history for frontend display
function getHistory(uint256 gameId) external view returns (QA[] memory)

// Get cost for actions
function getActionCost(uint256 gameId) external view returns (
    uint256 questionCost,  // LLM_DEPOSIT + gameFee
    uint256 guessCost      // LLM_DEPOSIT + gameFee
)

// Leaderboard
function getPlayerStats(address player) external view returns (PlayerStats memory)
function getKnownPlayersCount() external view returns (uint256)
function getKnownPlayers(uint256 offset, uint256 limit) external view returns (address[])
```

## Events

```solidity
event GameCreated(uint256 indexed gameId, address indexed gameMaster, uint256 pot, uint256 gameFee, Difficulty difficulty);
event GameReady(uint256 indexed gameId);
event QuestionAsked(uint256 indexed gameId, address indexed player, string question, uint256 newPot);
event QuestionAnswered(uint256 indexed gameId, string question, string answer, uint256 questionCount);
event GuessAttempted(uint256 indexed gameId, address indexed player, string guess, uint256 newPot);
event GuessResult(uint256 indexed gameId, address indexed player, string guess, bool correct);
event GameWon(uint256 indexed gameId, address indexed winner, string guess, uint256 prize);
event GameEnded(uint256 indexed gameId, address indexed recipient, uint256 amount, string reason);
event RequestFailed(uint256 indexed gameId, uint256 requestId, ResponseStatus status);
```

## Leaderboard

Player stats tracked on-chain:

```solidity
struct PlayerStats {
    uint256 questionsAsked;    // Total questions asked
    uint256 correctGuesses;    // Wins
    uint256 incorrectGuesses;  // Failed guesses
}
```

**Ranking:** Primary by wins, tiebreaker by questions asked.

## Privacy Model

The contract never stores or transmits the character name:

| On-Chain (Public) | Off-Chain (MCP Server) |
|-------------------|------------------------|
| Game state, phases | Character name |
| Questions asked | Character selection |
| Yes/no answers | LLM reasoning |
| Wrong guesses | Answer generation |
| Winner info | |

**Response Protocol:** Only these responses ever appear:
- `ready` - Game initialized
- `yes` / `no` - Question answers
- `correct` / `incorrect` - Guess results

## Deployment

### Constructor

```solidity
constructor(address _feeRecipient, string memory _mcpServerUrl)
```

- `_feeRecipient`: Address receiving 3% protocol fees
- `_mcpServerUrl`: URL of MCP server (e.g., `https://your-server.com/api/ghostmind`)

### Admin Functions

```solidity
function setMcpServerUrl(string memory _url) external  // Owner only
```

## Security Considerations

1. **Callback Validation:** Only accepts callbacks from `PLATFORM` address
2. **Phase Guards:** Functions check game phase before executing
3. **Reentrancy:** Uses checks-effects-interactions pattern
4. **Timeout Recovery:** 30-minute timeout prevents stuck games
5. **Fee Handling:** Excess payments automatically refunded

## Gas Estimates

| Function | Approximate Gas |
|----------|----------------|
| createGame | ~200,000 |
| askQuestion | ~150,000 |
| finalGuess | ~180,000 |
| Callback handlers | ~100,000-200,000 |

## License

MIT
