# Fair Draw Frontend

Next.js frontend for Fair Draw - a verifiable commit-then-reveal raffle on
GenLayer, no LLM. Reads and writes the deployed `FairDraw` contract on
**GenLayer Bradbury Testnet** (chain ID 4221).

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file:

```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` - your deployed FairDraw contract address
   - `NEXT_PUBLIC_GENLAYER_RPC_URL` - Bradbury RPC (default: `https://rpc-bradbury.genlayer.com`)
   - `NEXT_PUBLIC_GENLAYER_CHAIN_ID` - must stay `4221` (Bradbury), consistent with the RPC URL above

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

```bash
npm run build
npm start
```

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **genlayer-js** - GenLayer blockchain SDK
- **TanStack Query (React Query)** - Data fetching and caching
- **Radix UI** - Accessible component primitives

## Wallet

Connects via MetaMask (or any injected EIP-1193 provider) and prompts the
user to add/switch to the GenLayer Bradbury Testnet if needed. No private
keys are ever generated, imported, or stored by this app. The connect
flow renders as a live instrument-log sequence (provider detected,
network check, handshake, signal lock) rather than a modal dialog.

## Features

- **Open a round**: `open_round(round_id)` starts a fixed 5-minute entry
  window
- **Enter**: `enter(round_id)` - one entry per wallet while the window is
  open
- **Draw**: `draw(round_id)` - once the window closes, derives the winner
  from a pre-committed public drand beacon round
- **Entrant catalog**: every entrant for a round, read from
  `get_entrants`, with the winner highlighted once drawn
- **Verify independently**: the exact drand round, randomness, and winner
  index are shown with a direct link to drand's public API
