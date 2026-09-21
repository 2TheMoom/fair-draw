"""Direct-mode tests for the FairDraw contract."""

import json
from datetime import datetime, timezone

CONTRACT = "contracts/fair_draw.py"

DRAND_GENESIS_TIME = 1595431050
DRAND_PERIOD_SECONDS = 30

T0 = "2026-01-01T00:00:00Z"
T0_TS = int(datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp())
ENTRY_DEADLINE_TS = T0_TS + 300  # ENTRY_WINDOW_SECONDS
TARGET_ROUND = (ENTRY_DEADLINE_TS - DRAND_GENESIS_TIME) // DRAND_PERIOD_SECONDS + 1

T_DURING_WINDOW = "2026-01-01T00:02:00Z"  # 2 min in - still open
T_AFTER_DEADLINE = "2026-01-01T00:05:01Z"  # just past the 5 min window
T_WELL_AFTER = "2026-01-01T00:10:00Z"

RANDOMNESS_A = "7f2a91cd4e0b8f61a3d5c9027fbe114c6a8d0f5e2b9741ac83d6f0e2b4179a2e"


def _mock_drand(vm, target_round: int, randomness_hex: str | None, found: bool = True):
    vm.clear_mocks()
    if found:
        body = json.dumps({"round": target_round, "randomness": randomness_hex})
        status = 200
    else:
        body = json.dumps({"error": "not found"})
        status = 404
    vm.mock_web(
        r"api\.drand\.sh/public/" + str(target_round) + r"$",
        {"method": "GET", "status": status, "body": body},
    )


def test_open_round_creates_round(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)

    contract.open_round("launch-giveaway")

    round_ = contract.get_round("launch-giveaway")
    assert round_["created_at"] == T0_TS
    assert round_["entry_deadline"] == ENTRY_DEADLINE_TS
    assert round_["drawn"] is False
    assert round_["winner"] == ""
    assert round_["entrant_count"] == 0


def test_open_round_duplicate_fails(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("launch-giveaway")

    with direct_vm.expect_revert("already exists"):
        contract.open_round("launch-giveaway")


def test_enter_adds_to_round(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")

    direct_vm.sender = direct_alice
    contract.enter("r1")

    round_ = contract.get_round("r1")
    assert round_["entrant_count"] == 1
    assert contract.has_entered("r1", "0x" + "0" * 40) is False


def test_enter_unknown_round_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("not found"):
        contract.enter("nonexistent")


def test_enter_after_deadline_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")

    direct_vm.warp(T_AFTER_DEADLINE)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Entry window has closed"):
        contract.enter("r1")


def test_enter_twice_same_wallet_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")

    direct_vm.sender = direct_alice
    contract.enter("r1")

    with direct_vm.expect_revert("already entered"):
        contract.enter("r1")


def test_enter_after_drawn_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")

    direct_vm.sender = direct_alice
    contract.enter("r1")
    direct_vm.sender = direct_bob
    contract.enter("r1")

    direct_vm.warp(T_AFTER_DEADLINE)
    _mock_drand(direct_vm, TARGET_ROUND, RANDOMNESS_A)
    contract.draw("r1")

    with direct_vm.expect_revert("already been drawn"):
        contract.enter("r1")


def test_draw_before_deadline_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")

    direct_vm.sender = direct_alice
    contract.enter("r1")
    direct_vm.sender = direct_bob
    contract.enter("r1")

    direct_vm.warp(T_DURING_WINDOW)
    with direct_vm.expect_revert("still open"):
        contract.draw("r1")


def test_draw_with_fewer_than_two_entrants_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")

    direct_vm.sender = direct_alice
    contract.enter("r1")

    direct_vm.warp(T_AFTER_DEADLINE)
    with direct_vm.expect_revert("at least 2 entrants"):
        contract.draw("r1")


def test_draw_unknown_round_fails(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    with direct_vm.expect_revert("not found"):
        contract.draw("nonexistent")


def test_draw_picks_winner_from_entrants(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")

    for who in (direct_alice, direct_bob, direct_charlie):
        direct_vm.sender = who
        contract.enter("r1")

    entrants_before = contract.get_entrants("r1")
    assert len(entrants_before) == 3

    direct_vm.warp(T_AFTER_DEADLINE)
    _mock_drand(direct_vm, TARGET_ROUND, RANDOMNESS_A)
    contract.draw("r1")

    round_ = contract.get_round("r1")
    expected_index = int(RANDOMNESS_A, 16) % len(entrants_before)
    assert round_["drawn"] is True
    assert round_["winner_index"] == expected_index
    assert round_["winner"] == entrants_before[expected_index]
    assert round_["drand_round"] == TARGET_ROUND
    assert round_["randomness"] == RANDOMNESS_A


def test_draw_already_drawn_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")
    direct_vm.sender = direct_alice
    contract.enter("r1")
    direct_vm.sender = direct_bob
    contract.enter("r1")

    direct_vm.warp(T_AFTER_DEADLINE)
    _mock_drand(direct_vm, TARGET_ROUND, RANDOMNESS_A)
    contract.draw("r1")

    with direct_vm.expect_revert("already been drawn"):
        contract.draw("r1")


def test_draw_reverts_cleanly_when_randomness_unavailable(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """The committed drand round hasn't been published yet (or the fetch
    failed) - must revert cleanly, not crash, and leave the round
    re-drawable once the pulse is actually available."""
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")
    direct_vm.sender = direct_alice
    contract.enter("r1")
    direct_vm.sender = direct_bob
    contract.enter("r1")

    direct_vm.warp(T_AFTER_DEADLINE)
    _mock_drand(direct_vm, TARGET_ROUND, None, found=False)

    with direct_vm.expect_revert("Randomness not yet available"):
        contract.draw("r1")

    assert contract.get_round("r1")["drawn"] is False

    _mock_drand(direct_vm, TARGET_ROUND, RANDOMNESS_A)
    contract.draw("r1")
    assert contract.get_round("r1")["drawn"] is True


def test_get_round_unknown_reverts(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    with direct_vm.expect_revert("not found"):
        contract.get_round("nonexistent")


def test_get_entrants_empty_for_unknown_round(direct_deploy):
    contract = direct_deploy(CONTRACT)
    assert contract.get_entrants("nonexistent") == []


def test_has_entered_true_false(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("r1")

    direct_vm.sender = direct_alice
    contract.enter("r1")

    from tests.direct.conftest import to_hex

    assert contract.has_entered("r1", to_hex(direct_alice)) is True
    assert contract.has_entered("r1", to_hex(direct_bob)) is False


def test_multiple_rounds_are_independent(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.warp(T0)
    contract.open_round("round-a")
    contract.open_round("round-b")

    direct_vm.sender = direct_alice
    contract.enter("round-a")
    direct_vm.sender = direct_bob
    contract.enter("round-b")

    assert contract.get_round("round-a")["entrant_count"] == 1
    assert contract.get_round("round-b")["entrant_count"] == 1
    assert len(contract.get_entrants("round-a")) == 1
    assert len(contract.get_entrants("round-b")) == 1
