# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from genlayer import *

ENTRY_WINDOW_SECONDS = 300  # 5 minutes

# drand's default public chain (League of Entropy "quicknet" predecessor
# used by the classic /public/{round} endpoint) - verified live against
# https://api.drand.sh/info at design time, not assumed.
DRAND_GENESIS_TIME = 1595431050
DRAND_PERIOD_SECONDS = 30
DRAND_API_BASE = "https://api.drand.sh/public/"

DRAND_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}


@allow_storage
@dataclass
class Round:
    created_at: u256
    entry_deadline: u256
    drawn: bool
    winner_hex: str  # "" until drawn
    winner_index: u256
    drand_round: u256  # 0 until drawn
    randomness_hex: str  # "" until drawn


class FairDraw(gl.Contract):
    """A verifiable, commit-then-reveal raffle - no LLM, no external RNG
    trust assumption beyond drand's own public randomness beacon.

    open_round(round_id) starts a fixed 5-minute entry window. enter()
    adds the caller once per round while it's open. draw() - callable
    once the window has closed and at least 2 wallets entered - derives
    the winner from a specific drand beacon round computed purely from
    entry_deadline: target_round = (entry_deadline - GENESIS) // PERIOD + 1.
    That number is fixed the instant the round opens, before its
    randomness value exists, so nobody can decide whether to enter after
    seeing the outcome. Validators independently fetch that exact round
    from drand's public API and must agree on it byte-for-byte before
    reaching consensus - unlike a live-drifting price feed, a finalized
    drand round is immutable, so the raw randomness is itself
    consensus-critical here, not just the derived winner.

    winner_index = int(randomness, 16) % entrant_count. The full entrant
    list is public (get_entrants), so anyone can recompute the winner
    themselves from the public beacon value alone - nothing here needs to
    be trusted, only checked. No value ever moves through this contract.
    """

    rounds: TreeMap[str, Round]
    entrants: TreeMap[str, DynArray[Address]]
    entered_by: TreeMap[str, bool]

    def __init__(self):
        pass

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    @gl.public.write
    def open_round(self, round_id: str) -> None:
        if round_id in self.rounds:
            raise gl.vm.UserError(f"Round '{round_id}' already exists")

        now = self._now()
        self.rounds[round_id] = Round(
            created_at=now,
            entry_deadline=now + ENTRY_WINDOW_SECONDS,
            drawn=False,
            winner_hex="",
            winner_index=0,
            drand_round=0,
            randomness_hex="",
        )

    @gl.public.write
    def enter(self, round_id: str) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError(f"Round '{round_id}' not found")

        round_ = self.rounds[round_id]
        if round_.drawn:
            raise gl.vm.UserError("This round has already been drawn")
        if self._now() >= round_.entry_deadline:
            raise gl.vm.UserError("Entry window has closed for this round")

        sender = gl.message.sender_address
        dedupe_key = f"{round_id}_{sender.as_hex}".lower()
        if dedupe_key in self.entered_by:
            raise gl.vm.UserError("This wallet has already entered this round")

        self.entered_by[dedupe_key] = True
        self.entrants.get_or_insert_default(round_id).append(sender)

    def _fetch_drand_round(self, target_round: int) -> dict:
        def leader_fn() -> dict:
            url = f"{DRAND_API_BASE}{target_round}"
            try:
                resp = gl.nondet.web.request(url, method="GET", headers=DRAND_HEADERS)
                data = json.loads((resp.body or b"").decode("utf-8"))
                randomness = data.get("randomness")
                if not isinstance(randomness, str) or not randomness:
                    return {"found": False, "randomness": ""}
                return {"found": True, "randomness": randomness.lower()}
            except (ValueError, AttributeError, TypeError):
                return {"found": False, "randomness": ""}

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            my_result = leader_fn()
            return (
                my_result["found"] == leaders_res.calldata["found"]
                and my_result["randomness"] == leaders_res.calldata["randomness"]
            )

        return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

    @gl.public.write
    def draw(self, round_id: str) -> None:
        if round_id not in self.rounds:
            raise gl.vm.UserError(f"Round '{round_id}' not found")

        round_ = self.rounds[round_id]
        if round_.drawn:
            raise gl.vm.UserError("This round has already been drawn")
        if self._now() < round_.entry_deadline:
            raise gl.vm.UserError("Entry window is still open for this round")

        entrant_list = list(self.entrants.get(round_id, []))
        if len(entrant_list) < 2:
            raise gl.vm.UserError("Need at least 2 entrants to draw a winner")

        target_round = (round_.entry_deadline - DRAND_GENESIS_TIME) // DRAND_PERIOD_SECONDS + 1
        result = self._fetch_drand_round(target_round)
        if not result.get("found"):
            raise gl.vm.UserError(
                "Randomness not yet available for this round's committed drand pulse - try again shortly"
            )

        randomness_hex = result["randomness"]
        winner_index = int(randomness_hex, 16) % len(entrant_list)
        winner = entrant_list[winner_index]

        round_.drawn = True
        round_.winner_hex = winner.as_hex
        round_.winner_index = winner_index
        round_.drand_round = target_round
        round_.randomness_hex = randomness_hex

    @gl.public.view
    def get_round(self, round_id: str) -> dict:
        if round_id not in self.rounds:
            raise gl.vm.UserError(f"Round '{round_id}' not found")
        r = self.rounds[round_id]
        return {
            "created_at": r.created_at,
            "entry_deadline": r.entry_deadline,
            "drawn": r.drawn,
            "winner": r.winner_hex,
            "winner_index": r.winner_index,
            "drand_round": r.drand_round,
            "randomness": r.randomness_hex,
            "entrant_count": len(self.entrants.get(round_id, [])),
        }

    @gl.public.view
    def get_entrants(self, round_id: str) -> list:
        return [a.as_hex for a in self.entrants.get(round_id, [])]

    @gl.public.view
    def has_entered(self, round_id: str, wallet: str) -> bool:
        key = f"{round_id}_{Address(wallet).as_hex}".lower()
        return key in self.entered_by
