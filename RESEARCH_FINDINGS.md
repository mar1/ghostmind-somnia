# GhostMind Research Findings

> Documentation of our exploration into MCP, privacy, and LLM consistency on Somnia

---

## Executive Summary

**Goal:** Create a "Reverse Akinator" game where an on-chain LLM picks a secret character, players ask yes/no questions, and the first correct guess wins a prize pool.

**Core Requirements:**
1. Character name stays SECRET (prize pool at stake)
2. LLM answers questions CONSISTENTLY
3. Use Somnia's decentralized LLM for reasoning

**Finding:** These three requirements are fundamentally incompatible with Somnia's current architecture.

---

## Test 1: MCP Privacy Test

### Hypothesis
MCP (Model Context Protocol) tool calls might be private - only the final LLM response would appear in receipts.

### Setup
- Created MCP server (`mcp-server/server.mjs`)
- Used `inferToolsChat` with MCP server URL
- Prompted LLM to pick a character and store it via MCP tool

### Test Command
```bash
PRIVATE_KEY=0x... MCP_URL=https://your-ngrok-url node test-mcp-privacy.mjs
```

### Result: ❌ MCP CALLS ARE PUBLIC

The receipt clearly shows both tool call arguments AND tool results:

```json
{
  "name": "tool_call",
  "arguments": "{\"action\": \"store\", \"character\": \"Leonardo DiCaprio\"}",
  "is_mcp": true
},
{
  "name": "tool_result",
  "content": "Character \"Leonardo DiCaprio\" has been stored..."
}
```

### Conclusion
**Everything sent to/from MCP is visible in public receipts.** This is by design - Somnia validators need to verify all LLM operations for consensus.

---

## Test 2: LLM Consistency with inferChat + History

### Hypothesis
If we replay the full conversation history with each `inferChat` call, the LLM (Qwen3-30B) will stay consistent with its character choice.

### Setup
- Created test script (`test-consistency.mjs`)
- System prompt with strong consistency instructions
- Full chat history replayed on each call
- DEBUG mode to reveal character after each question

### Test Command
```bash
PRIVATE_KEY=0x... node test-consistency.mjs
```

### Result: ❌ LLM DOES NOT MAINTAIN CONSISTENCY

Example session:
```
Init:           "Whitney Houston"
After Q1:       "Mariah Carey" ❌ CHANGED!
```

Another session:
```
Init:           "Leonardo da Vinci"
After Q1:       "Leonardo da Vinci" ✅
After Q2:       "Michelangelo Buonarroti" ❌ CHANGED!
```

### Variations Tested

| Approach | Result |
|----------|--------|
| Basic system prompt | ❌ Character changes |
| Strong consistency instructions | ❌ Character changes |
| Trait anchoring ("ready \| male \| dead \| german \| physicist") | ❌ Character still changes |
| Randomized themes per game | ❌ Character still changes |

### Conclusion
**Qwen3-30B does not maintain internal state across separate API calls**, even when:
- Full conversation history is replayed
- Strong consistency instructions are given
- Character traits are stated and included in history

Each `inferChat` call is fundamentally stateless. The LLM re-interprets the history fresh each time and may "drift" to a different character.

---

## Test 3: Factual Accuracy

### Observation
Even when the LLM maintains the same character name, it often gives factually incorrect answers.

### Examples

**Michael Jordan:**
```
Q: Is he a basketball star?
A: NO ❌ (Michael Jordan IS a basketball star)
```

**Albert Einstein:**
```
Q: Is he German?
A: NO ❌ (Einstein was born in Germany)
```

**Hypatia of Alexandria:**
```
Q: Is she a woman?
A: NO ❌ (Hypatia was a woman)
```

### Conclusion
The LLM (Qwen3-30B) has inconsistent factual knowledge, even about famous people. This is a separate issue from consistency but compounds the problem.

---

## Architecture Analysis

### How Somnia Agent Receipts Work

```
User Tx → Somnia Platform → LLM Agent → Response
                ↓
         Public Receipt (stored on IPFS/cloud)
```

**What's in receipts:**
- Full request payload (prompts, system messages)
- All tool calls (MCP requests and responses)
- LLM responses
- Execution steps

**Why it's public:** Validators need to verify that the LLM produced the correct output. Consensus requires transparency.

### The Fundamental Constraint

```
┌─────────────────────────────────────────────────────────────┐
│                    SOMNIA ARCHITECTURE                       │
│                                                              │
│   Everything the LLM sees → Public (for consensus)          │
│   Everything the LLM outputs → Public (for verification)    │
│   All MCP/tool interactions → Public (for reproducibility)  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**There is no private channel to the LLM.**

---

## Approaches Evaluated

### 1. inferChat + History Replay (Current V2)
```
Init: LLM picks character internally, says "ready"
Questions: Replay full Q&A history, LLM answers
Guess: LLM validates based on memory
```

| Aspect | Status |
|--------|--------|
| Character private | ✅ Never in prompts |
| Consistency | ❌ LLM changes character |
| Uses Somnia LLM | ✅ Yes |

**Verdict:** Character stays hidden but LLM is unreliable.

---

### 2. MCP Reminds LLM of Character
```
Init: MCP picks character, tells LLM
Questions: MCP reminds LLM each time
Guess: MCP tells LLM to validate
```

| Aspect | Status |
|--------|--------|
| Character private | ❌ Visible in receipts |
| Consistency | ✅ MCP ensures it |
| Uses Somnia LLM | ✅ Yes |

**Verdict:** Consistent but character exposed in receipts.

---

### 3. MCP Answers Everything
```
Init: MCP picks character, stores privately, returns "ready"
Questions: MCP answers yes/no (using external LLM)
Guess: MCP compares, returns correct/incorrect
```

| Aspect | Status |
|--------|--------|
| Character private | ✅ Never leaves MCP |
| Consistency | ✅ MCP controls it |
| Uses Somnia LLM | ❌ Just orchestrates |

**Verdict:** Private and consistent, but Somnia LLM wasted.

---

### 4. JSON API Agent + MCP
```
Init: JSON API calls MCP → "ready"
Questions: JSON API calls MCP → "yes"/"no"
Guess: JSON API calls MCP → "correct"/"incorrect"
```

| Aspect | Status |
|--------|--------|
| Character private | ✅ Never in responses |
| Consistency | ✅ MCP controls it |
| Uses Somnia LLM | ❌ Uses JSON API agent instead |
| Cost | ✅ Cheaper (0.12 vs 0.24 STT) |

**Verdict:** Same as #3 but cheaper. Still doesn't use LLM knowledge.

---

### 5. Trusted Game Master (Off-chain)
```
Init: GM picks character off-chain, stores hash on-chain
Questions: GM answers, signs responses
Guess: GM validates, reveals character + salt for verification
```

| Aspect | Status |
|--------|--------|
| Character private | ✅ Off-chain |
| Consistency | ✅ GM controls it |
| Uses Somnia LLM | ❌ Not at all |
| Decentralized | ❌ Requires trusted GM |

**Verdict:** Works but centralized.

---

### 6. Seed Determinism (Deprecated V1)
```
Init: Pass gameId as seed, LLM picks character based on seed
Questions: Same seed → same character
```

| Aspect | Status |
|--------|--------|
| Character private | ✅ Derived, not stored |
| Consistency | ❌ Qwen3-30B not deterministic |
| Uses Somnia LLM | ✅ Yes |

**Verdict:** Doesn't work. Same seed ≠ same character with Qwen3-30B.

---

## Alternative Ideas Explored

### Block Hash Encryption
**Idea:** Encrypt character using block hash, only LLM can decrypt.
**Problem:** LLMs can't perform cryptographic operations.

### Future Block Hash
**Idea:** Character = list[hash(futureBlock) % length]
**Problem:** Once block is mined, everyone can calculate the character.

### Trait-Based (No Specific Character)
**Idea:** Character is just a bundle of traits, not a real person.
**Problem:** Changes the game fundamentally, guessing becomes vague.

### Reverse Game Logic
**Idea:** Character is derived from Q&A pattern at the end.
**Problem:** Q&A might not match any real person consistently.

### LLM as Encryption Key
**Idea:** LLM's weights are the "key" - same prompt always produces same output.
**Problem:** Tested as seed determinism, doesn't work reliably.

---

## Core Blocker

```
┌─────────────────────────────────────────────────────────────┐
│                     THE IMPOSSIBLE TRIANGLE                  │
│                                                              │
│                      Character Private                       │
│                            /\                                │
│                           /  \                               │
│                          /    \                              │
│                         /      \                             │
│                        /   ??   \                            │
│                       /          \                           │
│                      /____________\                          │
│          Somnia LLM             Consistent                   │
│          Reasons                Answers                      │
│                                                              │
│  PICK ANY TWO. YOU CANNOT HAVE ALL THREE.                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Why?

1. **Character Private + Somnia LLM Reasons**
   → LLM needs the character to reason about it
   → Character must be in prompt
   → Prompts are public in receipts
   → ❌ Character exposed

2. **Character Private + Consistent Answers**
   → External system (MCP) holds character
   → MCP answers questions
   → Somnia LLM not used for reasoning
   → ✅ Works, but LLM wasted

3. **Somnia LLM Reasons + Consistent Answers**
   → MCP must remind LLM of character each call
   → Character in MCP response
   → Responses are public in receipts
   → ❌ Character exposed

---

## Recommendations

### Option A: Accept MCP Answering (Privacy First)
- MCP picks character, keeps it private
- MCP answers all questions using external LLM
- Somnia provides infrastructure (consensus, callbacks) but not reasoning
- **Best for:** Maximum privacy, prize pool security

### Option B: Accept Receipt Exposure (Somnia LLM First)
- MCP reminds LLM of character (visible in receipts)
- Add game mechanics to mitigate:
  - Players commit guess hash before seeing answers
  - Speed-based: first correct guess wins
  - Short time windows
- **Best for:** Using Somnia's LLM, accepting "security through obscurity"

### Option C: Hybrid with Trusted GM
- Off-chain Game Master holds secret
- GM signs answers, hash commit-reveal for verification
- Not decentralized but verifiable
- **Best for:** Traditional game with blockchain verification

### Option D: Wait for Somnia Private Execution
- TEE-based agents might enable private LLM state
- Not available currently
- **Best for:** Future-proofing

---

## Files Created During Research

```
mcp-server/
├── server.mjs          # MCP server (JSON-RPC protocol)
├── package.json

test-mcp-privacy.mjs    # Tests MCP privacy (result: public)
test-consistency.mjs    # Tests LLM consistency (result: inconsistent)
receipt-debug.json      # Sample receipt showing exposed data

RESEARCH_FINDINGS.md    # This file
```

---

## Key Takeaways

1. **Somnia receipts are fully public** - by design, for validator consensus
2. **MCP tool calls are not private** - both requests and responses are logged
3. **Qwen3-30B doesn't maintain state** - even with history replay, character drifts
4. **Factual accuracy is unreliable** - wrong answers about well-known facts
5. **The "impossible triangle"** - can't have privacy + Somnia reasoning + consistency

---

## Next Steps

Decide which trade-off is acceptable:

- [ ] **Privacy-first:** MCP answers everything, Somnia LLM orchestrates only
- [ ] **Somnia-first:** Accept receipt exposure, add game mechanics
- [ ] **Hybrid:** Trusted GM with blockchain verification
- [ ] **Wait:** Future Somnia features (TEE, private execution)

---

*Last updated: 2026-06-02*
*Research conducted with: Somnia Testnet, Qwen3-30B LLM Agent*
