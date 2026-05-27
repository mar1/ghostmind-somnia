export const ghostMindAbi = [
  // ─── Constants ───────────────────────────────────────────
  {
    type: "function",
    name: "LLM_DEPOSIT",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PROTOCOL_FEE_BPS",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "gameCounter",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeRecipient",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },

  // ─── Write Functions ─────────────────────────────────────
  {
    type: "function",
    name: "createGame",
    inputs: [
      { name: "gameFee", type: "uint256" },
      { name: "difficulty", type: "uint8" },
    ],
    outputs: [{ name: "gameId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "askQuestion",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "question", type: "string" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "finalGuess",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "guess", type: "string" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "resetStuckGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Read Functions ──────────────────────────────────────
  {
    type: "function",
    name: "getGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "gameMaster", type: "address" },
      { name: "phase", type: "uint8" },
      { name: "difficulty", type: "uint8" },
      { name: "gameFee", type: "uint256" },
      { name: "pot", type: "uint256" },
      { name: "questionCount", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getHistory",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "question", type: "string" },
          { name: "answer", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActionCost",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "questionCost", type: "uint256" },
      { name: "guessCost", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getChatHistory",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "roles", type: "string[]" },
      { name: "messages", type: "string[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "games",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "gameMaster", type: "address" },
      { name: "phase", type: "uint8" },
      { name: "difficulty", type: "uint8" },
      { name: "gameFee", type: "uint256" },
      { name: "pot", type: "uint256" },
      { name: "questionCount", type: "uint256" },
      { name: "pendingQuestion", type: "string" },
      { name: "pendingPlayer", type: "address" },
      { name: "pendingType", type: "uint8" },
      { name: "pendingRequestId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "winningGuess", type: "string" },
      { name: "createdAt", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // ─── Events ──────────────────────────────────────────────
  {
    type: "event",
    name: "GameCreated",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "gameMaster", type: "address", indexed: true },
      { name: "pot", type: "uint256", indexed: false },
      { name: "gameFee", type: "uint256", indexed: false },
      { name: "difficulty", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameReady",
    inputs: [{ name: "gameId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "QuestionAsked",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "question", type: "string", indexed: false },
      { name: "newPot", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "QuestionAnswered",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "question", type: "string", indexed: false },
      { name: "answer", type: "string", indexed: false },
      { name: "questionCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GuessAttempted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "guess", type: "string", indexed: false },
      { name: "newPot", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GuessResult",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "guess", type: "string", indexed: false },
      { name: "correct", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameWon",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "guess", type: "string", indexed: false },
      { name: "prize", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameEnded",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RequestFailed",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: false },
      { name: "status", type: "uint8", indexed: false },
    ],
  },
] as const;

// Enums matching the contract
export enum GamePhase {
  NonExistent = 0,
  Initializing = 1,
  Active = 2,
  Processing = 3,
  Finished = 4,
}

export enum Difficulty {
  Easy = 0,
  Medium = 1,
  Hard = 2,
}

export enum RequestType {
  Init = 0,
  Question = 1,
  Guess = 2,
}

// Phase labels for UI
export const phaseLabels: Record<GamePhase, string> = {
  [GamePhase.NonExistent]: "Non-existent",
  [GamePhase.Initializing]: "Initializing",
  [GamePhase.Active]: "Active",
  [GamePhase.Processing]: "Processing",
  [GamePhase.Finished]: "Finished",
};

export const difficultyLabels: Record<Difficulty, string> = {
  [Difficulty.Easy]: "Easy",
  [Difficulty.Medium]: "Medium",
  [Difficulty.Hard]: "Hard",
};
