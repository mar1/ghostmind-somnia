# GhostMind Frontend

The web application for GhostMind - an on-chain guessing game powered by Somnia LLM Agents.

**Live:** [ghostmind.mar1.dev](https://ghostmind.mar1.dev)

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **UI:** React 19, TypeScript, Tailwind CSS 4
- **Web3:** Wagmi 2, RainbowKit 2, Viem 2
- **Data:** TanStack Query 5

## Getting Started

### Prerequisites

- Node.js 18+
- A WalletConnect Project ID (get one at [cloud.walletconnect.com](https://cloud.walletconnect.com))

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Séance Hall - browse active games
│   ├── summon/page.tsx    # Create new game
│   ├── game/[id]/page.tsx # Active game play
│   ├── reveal/[id]/page.tsx # Game results with Wikipedia info
│   ├── leaderboard/page.tsx # Player rankings
│   ├── layout.tsx         # Root layout with providers
│   └── providers.tsx      # Web3 providers (Wagmi, RainbowKit, Query)
│
├── components/
│   ├── AppChrome.tsx      # Navigation header
│   └── ui/                # Reusable UI components
│       ├── Button.tsx
│       ├── TextField.tsx
│       ├── Badge.tsx
│       ├── GhostOrb.tsx   # Animated oracle visualization
│       ├── QARow.tsx      # Question/answer display
│       ├── PhasePip.tsx   # Game phase indicator
│       └── ...
│
├── contracts/
│   ├── abi.ts             # Contract ABI and type definitions
│   ├── addresses.ts       # Contract addresses per chain
│   └── index.ts           # Exports and constants (LLM_DEPOSIT, etc.)
│
├── hooks/                  # Custom React hooks
│   ├── useGame.ts         # Single game state
│   ├── useGames.ts        # Query multiple games
│   ├── useCreateGame.ts   # Create game transaction
│   ├── useAskQuestion.ts  # Ask question transaction
│   ├── useFinalGuess.ts   # Submit guess transaction
│   ├── useGameEvents.ts   # Real-time event listeners
│   ├── useLeaderboard.ts  # Player stats and rankings
│   └── useWikipediaInfo.ts # Fetch character info on reveals
│
├── lib/
│   ├── pot.ts             # Pot calculation utilities
│   └── contractLogs.ts    # Event log fetching with pagination
│
└── wagmi.ts               # Chain config and wallet setup
```

## Pages

### Séance Hall (`/`)
Browse all active games with filtering:
- **All** - All active games sorted by pot
- **Open** - Games in Active phase only
- **High pot** - Sorted by highest pot
- **Few questions** - Sorted by fewest questions
- **Your rounds** - Games you created

### Summon (`/summon`)
Create a new game:
- Set prize pool seed amount
- Set fee per question/guess
- Choose difficulty (Easy/Medium/Hard)

### Game (`/game/[id]`)
Play an active game:
- View question/answer history
- Ask yes/no questions
- Make final guesses
- Real-time updates via event listeners

### Reveal (`/reveal/[id]`)
View completed game results:
- Character reveal with Wikipedia info
- Full Q&A transcript
- Pot breakdown and winner info
- Navigate between finished games

### Leaderboard (`/leaderboard`)
Player rankings:
- Sorted by wins (correct guesses)
- Shows questions asked, wins, wrong guesses, win rate
- Your personal stats
- Global statistics

## Contract Integration

The frontend connects to GhostMindV2 on Somnia Testnet:

| Property | Value |
|----------|-------|
| Contract | `0x6291d4912cf13C67bbfdfDfF42fE941970E94326` |
| Chain ID | 50312 |
| RPC | `https://dream-rpc.somnia.network` |
| Explorer | `https://somnia-testnet.socialscan.io` |

## Key Constants

```typescript
LLM_DEPOSIT = 0.24      // STT per LLM call
PROTOCOL_FEE_BPS = 300  // 3% protocol fee
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variable: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
4. Deploy

### Manual

```bash
npm run build
# Deploy .next folder to your hosting provider
```

## Development Notes

### Wagmi Hooks Pattern
All blockchain interactions use Wagmi hooks:
- `useReadContract` / `useReadContracts` for reading state
- `useWriteContract` for transactions
- `useWatchContractEvent` for real-time updates

### Event Handling
The `useGameEvents` hook listens for:
- `GameReady` - Game initialized
- `QuestionAnswered` - Question response received
- `GuessResult` - Guess evaluated
- `GameWon` - Game completed with winner

### Pot Calculations
The `pot.ts` utility handles complex pot display:
- Reconstructs pot from history when drained after payout
- Calculates winner payout (pot - 3% fee)
- Tracks question count and guess counts

## License

MIT
