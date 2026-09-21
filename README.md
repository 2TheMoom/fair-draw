# Fair Draw
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit/)
[![Discord](https://img.shields.io/badge/Discord-Join%20us-5865F2?logo=discord&logoColor=white)](https://discord.gg/8Jm4v89VAu)
[![Telegram](https://img.shields.io/badge/Telegram--T.svg?style=social&logo=telegram)](https://t.me/genlayer)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/yeagerai.svg?style=social&label=Follow%20%40GenLayer)](https://x.com/GenLayer)

## About
Fair Draw is a GenLayer Intelligent Contract that runs a verifiable
commit-then-reveal raffle - with no LLM anywhere in the contract, and no
external randomness trust assumption beyond a public beacon anyone can
check themselves.

`open_round(round_id)` starts a fixed 5-minute entry window. `enter(round_id)`
adds the caller once per round while it's open. `draw(round_id)` - callable
once the window has closed and at least 2 wallets entered - derives the
winner from a specific [drand](https://drand.love) public randomness beacon
round, computed purely from `entry_deadline`:

```
target_round = (entry_deadline - DRAND_GENESIS_TIME) // DRAND_PERIOD_SECONDS + 1
```

That number is fixed the instant the round opens, before its randomness
value exists - so nobody can decide whether to enter after seeing the
outcome. Validators independently fetch that exact round from drand's
public API and must agree on it byte-for-byte before reaching consensus -
unlike a live-drifting price feed, a finalized drand round is immutable,
so the raw randomness is itself consensus-critical here, not just the
derived winner. `winner_index = int(randomness, 16) % entrant_count`. The
full entrant list is public (`get_entrants`), so anyone can recompute the
winner themselves from the public beacon value alone.

Like [Handle](https://github.com/2TheMoom/handle) and
[Corroborate](https://github.com/2TheMoom/corroborate), this project
deliberately skips `gl.nondet.exec_prompt` - proving GenVM's deterministic-
consensus pattern extends from confirming a live fact to deriving a fair,
unpredictable-but-verifiable outcome. No native value ever moves through
this contract.

## Live deployment
Deployed on **GenLayer Bradbury Testnet** (chain ID 4221):
- **Contract:** [`0xc1855418c4F8149861CA5E1052a5192b7c0D339c`](https://explorer-bradbury.genlayer.com/address/0xc1855418c4F8149861CA5E1052a5192b7c0D339c)
- **Frontend:** https://fair-draw-frontend.vercel.app
- Verified via 17 passing direct-mode tests (`python -m pytest tests/direct/`),
  covering the full round lifecycle, entry-window enforcement, the
  2-entrant minimum, duplicate-entry and double-draw guards, and a
  clean revert (with a re-drawable round afterward) when the committed
  drand round isn't yet available.
- Verified live end-to-end against the real drand public API (not just
  direct-mode tests): opened a round with two independent wallets,
  waited for the real 5-minute window to close, and called `draw()` -
  validators reached full 5/5 consensus and the contract recorded
  drand round `6486225`. Independently re-fetching that exact round
  from `api.drand.sh/public/6486225` returns the byte-identical
  randomness the contract stored, and recomputing
  `int(randomness, 16) % 2` by hand gives `0`, matching the contract's
  own `winner_index: 0` exactly - the draw is reproducible from the
  public beacon alone, without trusting this contract's word for it.

## What's included
- `contracts/fair_draw.py` — the FairDraw Intelligent Contract
- `tests/direct/test_fair_draw.py` — direct-mode tests (in-memory, mocked drand API, time-warped)
- **Contract linting** — static analysis to catch common contract issues before deployment
- **CI pipeline** — GitHub Actions workflow for linting and direct tests
- A Next.js 16 frontend (TypeScript, TanStack Query, Radix UI) — an
  observatory/telemetry HUD: a real pulse-timing waveform for the
  round's committed target, an entrant catalog, and a "verify
  independently" panel linking straight to drand's public API
- Configuration file template and deployment scripts

## Requirements
- Python >= 3.12
- [GenLayer CLI](https://github.com/genlayerlabs/genlayer-cli) globally installed: `npm install -g genlayer`
- GenLayer Studio (for integration tests and deployment): Install from [Docs](https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup#using-the-genlayer-studio) or use the hosted [GenLayer Studio](https://studio.genlayer.com/)

## Project Structure

```
contracts/              # Python intelligent contracts
  fair_draw.py            # Fair Draw
tests/
  direct/                # Fast in-memory tests (no Studio required)
    test_fair_draw.py
frontend/                # Next.js 16 app (TypeScript, TanStack Query, Radix UI)
deploy/                  # TypeScript deployment scripts
gltest.config.yaml       # Test runner network configuration
pyproject.toml           # Python/pytest configuration
.github/workflows/       # CI pipeline
```

## Quick Start

### 1. Set up Python environment

```shell
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Lint the contract

```shell
genvm-lint check contracts/fair_draw.py
```

### 3. Run direct mode tests

```shell
python -m pytest tests/direct/ -v
```

Use `python -m pytest`, not bare `pytest` - depending on your installed
pytest version, running the bare command can fail to put the project
root on `sys.path`, breaking test discovery with
`ModuleNotFoundError: No module named 'tests'`.

### 4. Deploy the contract

1. Choose your network: `genlayer network`
2. Deploy: `genlayer deploy` (runs the script in `/deploy/deployScript.ts`)

### 5. Set up the frontend

1. Copy `frontend/.env.example` to `frontend/.env`
2. Add your deployed contract address as `NEXT_PUBLIC_CONTRACT_ADDRESS`
3. Run:

```shell
cd frontend
npm install
npm run dev
```

The app will be available at http://localhost:3000/.

## How Fair Draw Works

1. **`open_round(round_id)`** — starts a fixed 5-minute entry window for
   a caller-chosen round ID.
2. **`enter(round_id)`** — one entry per wallet, only while the window's
   open.
3. **`draw(round_id)`** — callable once the window's closed and at least
   2 wallets entered. Fetches the pre-committed drand round and derives
   `winner_index = int(randomness, 16) % entrant_count`.
4. **`get_round` / `get_entrants` / `has_entered`** — read back a round's
   state, its full entrant list, and whether a wallet has entered.

## Testing Strategy

| Test Type | Command | Speed | Requires Studio |
|-----------|---------|-------|-----------------|
| **Lint** | `genvm-lint check contracts/fair_draw.py` | ~250ms | No |
| **Direct** | `python -m pytest tests/direct/ -v` | ~ms/test | No |

## Community
- **[Discord](https://discord.gg/8Jm4v89VAu)**: Discussions, support, and announcements
- **[Telegram](https://t.me/genlayer)**: Informal chats and quick updates

## Documentation
For detailed information, see our [documentation](https://docs.genlayer.com/).

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
