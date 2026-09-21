"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useWallet } from "@/lib/genlayer/wallet";
import { useRound, useEntrants, useHasEntered, useOpenRound, useEnter, useDraw } from "@/lib/hooks/useFairDraw";
import { getTxExplorerUrl } from "@/lib/genlayer/chains";

const DRAND_GENESIS_TIME = 1595431050;
const DRAND_PERIOD_SECONDS = 30;
const DRAND_API_BASE = "https://api.drand.sh/public/";

function useNowSeconds() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function shortAddr(hex: string): string {
  if (!hex) return "—";
  return `0x${hex.slice(0, 4)}…${hex.slice(-4)}`;
}

export default function HomePage() {
  const { isConnected, address } = useWallet();
  const now = useNowSeconds();

  const [roundIdInput, setRoundIdInput] = useState("genesis-draw");
  const [activeRoundId, setActiveRoundId] = useState("genesis-draw");

  const { data: round, isLoading: roundLoading } = useRound(activeRoundId);
  const { data: entrants, isLoading: entrantsLoading } = useEntrants(activeRoundId);
  const { data: hasEntered } = useHasEntered(activeRoundId, address);

  const { run: openRound, isPending: isOpening, pendingTxHash: openTxHash, clearPendingTx: clearOpenTx } = useOpenRound();
  const { run: enterRound, isPending: isEntering, pendingTxHash: enterTxHash, clearPendingTx: clearEnterTx } = useEnter();
  const { run: drawRound, isPending: isDrawing, pendingTxHash: drawTxHash, clearPendingTx: clearDrawTx } = useDraw();

  const exists = !!round;
  const deadline = round ? parseInt(round.entry_deadline, 10) : 0;
  const drawn = round?.drawn ?? false;
  const windowOpen = exists && !drawn && now < deadline;
  const windowClosedUndrawn = exists && !drawn && now >= deadline;
  const secondsLeft = deadline - now;

  const targetRound = useMemo(() => {
    if (!deadline) return 0;
    return Math.floor((deadline - DRAND_GENESIS_TIME) / DRAND_PERIOD_SECONDS) + 1;
  }, [deadline]);

  const entrantCount = entrants?.length ?? 0;

  const handleLoadRound = () => {
    if (!roundIdInput.trim()) return;
    setActiveRoundId(roundIdInput.trim());
  };

  const handleOpen = () => {
    clearOpenTx();
    openRound(activeRoundId);
  };
  const handleEnter = () => {
    clearEnterTx();
    enterRound(activeRoundId);
  };
  const handleDraw = () => {
    clearDrawTx();
    drawRound(activeRoundId);
  };

  const winnerAddr = round?.winner || "";
  const winnerIsEntrant = (entrants ?? []).findIndex((a) => a.toLowerCase() === winnerAddr.toLowerCase());

  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-[700px] mx-auto w-full px-0 pt-8 pb-10 relative">
        <span className="bracket tl" /><span className="bracket tr" /><span className="bracket bl" /><span className="bracket br" />

        <Navbar />

        <hr className="border-none border-t border-border mx-5 my-5" style={{ borderTopWidth: 2, borderTopColor: "var(--foreground)" }} />

        {/* ---------- Round selector ---------- */}
        <div className="px-5 flex items-center gap-2 flex-wrap">
          <span className="label shrink-0">Round ID</span>
          <input
            type="text"
            value={roundIdInput}
            onChange={(e) => setRoundIdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoadRound()}
            placeholder="e.g. launch-giveaway"
            className="flex-1 min-w-[140px] bg-transparent border border-border px-2.5 py-1.5 font-mono text-[0.78rem] text-foreground outline-none focus:border-primary"
          />
          <button type="button" onClick={handleLoadRound} className="link-ghost">
            [ LOAD ]
          </button>
        </div>

        {/* ---------- Waveform hero ---------- */}
        <div className="mt-6 px-5">
          <div className="flex justify-between">
            <span className="label">Pulse Timing &mdash; Round {activeRoundId}</span>
            <span className="label text-select">{exists ? (drawn ? "Drawn" : windowOpen ? "Entries Open" : "Awaiting Draw") : "Not Opened"}</span>
          </div>
          <svg className="w-full h-auto mt-2.5 block" viewBox="0 0 620 120" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="96" x2="620" y2="96" stroke="var(--border)" strokeWidth="1" />
            <path d="M0,96 L74,96 L80,28 L86,96 L174,96 L180,28 L186,96 L274,96 L280,28 L286,96 L374,96 L380,28 L386,96 L474,96"
              fill="none" stroke="#6FE8A8" strokeWidth="1.6" strokeLinejoin="round" opacity={drawn ? 1 : 0.55} />
            <path d="M474,96 L510,96 L516,28 L522,96 L556,96"
              fill="none" stroke="#F0B75E" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray={drawn ? undefined : "3 3"} opacity={drawn ? 1 : 0.85} />
            <circle cx="516" cy="28" r="2.6" fill="#F0B75E" />
            <text x="200" y="112" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--muted-foreground)">
              {exists ? "committed pulses" : "open a round to commit a target pulse"}
            </text>
            <text x="516" y="16" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fontWeight={600} fill="#F0B75E">
              {targetRound ? `${targetRound} · TARGET` : "TARGET"}
            </text>
          </svg>

          <div className="mt-4 flex justify-between items-baseline flex-wrap gap-2">
            <div className="font-head text-[1.05rem]">
              {roundLoading ? (
                <span className="text-muted-foreground text-sm">Loading round&hellip;</span>
              ) : !exists ? (
                <span className="text-muted-foreground">No round at this ID yet.</span>
              ) : (
                <>
                  <span className="text-signal-bright tabular">{entrantCount}</span> entrants logged &middot; window {drawn ? "closed" : windowOpen ? "OPEN" : "closed"}
                </>
              )}
            </div>
            {windowOpen && (
              <div className="font-head text-[1.4rem] text-select tabular">T&minus;{formatCountdown(secondsLeft)}</div>
            )}
          </div>

          {exists && !drawn && (
            <div className="mt-3.5 p-2.5 px-3.5 border border-border" style={{ borderLeftWidth: 2, borderLeftColor: "var(--select)" }}>
              <p className="text-[0.72rem] text-muted-foreground leading-relaxed">
                Draw round <b className="text-select tabular">{targetRound}</b> was fixed the instant this window opened &mdash; before its value existed. No entrant could have known it while deciding whether to enter.
              </p>
            </div>
          )}

          {drawn && (
            <div className="mt-3.5 p-3 px-3.5 border border-primary" style={{ background: "rgba(111,232,168,0.06)" }}>
              <p className="text-[0.8rem]">
                Winner: <b className="text-signal-bright font-mono">{shortAddr(winnerAddr)}</b>
                {winnerIsEntrant >= 0 && <span className="text-muted-foreground"> (entrant #{winnerIsEntrant + 1})</span>}
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3 flex-wrap">
            {!exists && !roundLoading && (
              <button type="button" onClick={handleOpen} disabled={!isConnected || isOpening} className="link-ghost" style={{ borderStyle: "solid", borderColor: "var(--primary)", color: "var(--signal-bright)" }}>
                {isOpening ? "[ OPENING… ]" : "[ OPEN THIS ROUND ]"}
              </button>
            )}
            {windowOpen && (
              <button
                type="button"
                onClick={handleEnter}
                disabled={!isConnected || isEntering || !!hasEntered}
                className="link-ghost"
                style={{ borderStyle: "solid", borderColor: "var(--primary)", color: "var(--signal-bright)" }}
              >
                {isEntering ? "[ ENTERING… ]" : hasEntered ? "[ ALREADY ENTERED ]" : "[ TAKE A TICKET → ]"}
              </button>
            )}
            {windowClosedUndrawn && (
              <button
                type="button"
                onClick={handleDraw}
                disabled={!isConnected || isDrawing || entrantCount < 2}
                className="link-ghost"
                style={{ borderStyle: "solid", borderColor: "var(--select)", color: "var(--select)" }}
              >
                {isDrawing ? "[ DRAWING… ]" : entrantCount < 2 ? "[ NEED 2+ ENTRANTS ]" : "[ DRAW WINNER ]"}
              </button>
            )}
            {!isConnected && <span className="text-[0.7rem] text-muted-foreground">Connect a wallet above to act on this round.</span>}
          </div>

          {(isOpening || isEntering || isDrawing) && (
            <div className="mt-2.5 font-mono text-[0.68rem] text-muted-foreground">
              {(openTxHash || enterTxHash || drawTxHash) ? (
                <>
                  Transaction submitted &mdash;{" "}
                  <a href={getTxExplorerUrl((openTxHash || enterTxHash || drawTxHash)!)} target="_blank" rel="noopener noreferrer" className="text-signal-bright hover:underline">
                    view on explorer
                  </a>
                </>
              ) : (
                "Preparing transaction..."
              )}
            </div>
          )}
        </div>

        {/* ---------- How it works ---------- */}
        <div className="mt-8 px-5 grid sm:grid-cols-3 border-t border-b border-border">
          <div className="telemetry-cell">
            <div className="label text-signal-bright">01 / TIMING</div>
            <h3 className="mt-2 text-[0.8rem] font-semibold font-mono">Fixed five-minute window</h3>
            <p className="mt-1.5 text-[0.7rem] text-muted-foreground leading-relaxed">Every round opens an identical entry period. Nothing on-chain can extend or shorten it once set.</p>
          </div>
          <div className="telemetry-cell">
            <div className="label text-signal-bright">02 / COMMIT</div>
            <h3 className="mt-2 text-[0.8rem] font-semibold font-mono">Target locked at open</h3>
            <p className="mt-1.5 text-[0.7rem] text-muted-foreground leading-relaxed">The exact beacon round used for the draw is computed from the window&apos;s own close time &mdash; fixed before it exists.</p>
          </div>
          <div className="telemetry-cell">
            <div className="label text-signal-bright">03 / CONSENSUS</div>
            <h3 className="mt-2 text-[0.8rem] font-semibold font-mono">Byte-identical reads</h3>
            <p className="mt-1.5 text-[0.7rem] text-muted-foreground leading-relaxed">Validators independently fetch the same immutable pulse and must agree exactly before the draw is accepted.</p>
          </div>
        </div>

        {/* ---------- Entrant catalog ---------- */}
        <div className="mt-8 px-5 flex justify-between items-baseline flex-wrap gap-2">
          <h2 className="font-head text-[0.92rem] font-bold">ENTRANT CATALOG &mdash; ROUND &quot;{activeRoundId.toUpperCase()}&quot;</h2>
          <span className="label">{drawn ? "DRAWN" : windowOpen ? "OPEN" : exists ? "AWAITING DRAW" : "—"} &middot; {entrantCount} LOGGED</span>
        </div>

        <div className="mt-2.5 px-5">
          {entrantsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog...
            </div>
          ) : entrantCount === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No entrants logged yet.</p>
          ) : (
            (entrants ?? []).map((addr, i) => {
              const isWinner = drawn && addr.toLowerCase() === winnerAddr.toLowerCase();
              return (
                <div
                  key={addr}
                  className="grid grid-cols-[70px_1fr_auto] items-center gap-3 py-2.5 border-t border-border text-[0.76rem] last:border-b"
                >
                  <span className={isWinner ? "text-select" : "text-muted-foreground"}>FD-{String(i + 1).padStart(2, "0")}</span>
                  <span className={`font-mono ${isWinner ? "text-select font-semibold" : "text-foreground"}`}>{shortAddr(addr.replace(/^0x/, ""))}</span>
                  <span className={`text-[0.66rem] text-right ${isWinner ? "text-select" : "text-muted-foreground"}`}>{isWinner ? "★ WINNER" : ""}</span>
                </div>
              );
            })
          )}
        </div>

        {/* ---------- Ephemeris / verify ---------- */}
        {drawn && round && (
          <div className="mt-7 mx-5 p-4 border border-border">
            <div className="label mb-2.5">Verify Independently</div>
            <div className="grid grid-cols-[110px_1fr] gap-x-3.5 gap-y-1.5 text-[0.72rem]">
              <span className="text-muted-foreground">ROUND</span><span className="text-signal-bright tabular">{round.drand_round}</span>
              <span className="text-muted-foreground">RANDOMNESS</span><span className="text-signal-bright break-all">{round.randomness}</span>
              <span className="text-muted-foreground">WINNER INDEX</span><span className="text-signal-bright tabular">{round.winner_index} of {entrantCount}</span>
              <span className="text-muted-foreground">SOURCE</span>
              <a href={`${DRAND_API_BASE}${round.drand_round}`} target="_blank" rel="noopener noreferrer" className="text-signal-bright hover:underline break-all">
                api.drand.sh/public/{round.drand_round}
              </a>
            </div>
            <p className="mt-3 text-[0.72rem] text-muted-foreground leading-relaxed">
              This app decides nothing. Fetch the round above from drand&apos;s public API yourself and recompute the winner &mdash; the catalog and the arithmetic are both public.
            </p>
          </div>
        )}

        <div className="mt-8 px-5 pt-4 border-t border-border flex justify-between flex-wrap gap-2 font-mono text-[0.64rem] text-muted-foreground">
          <span>GenLayer Bradbury Testnet</span>
          <div className="flex items-center gap-4">
            <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="hover:text-signal-bright transition-colors">GenLayer</a>
            <a href="https://docs.genlayer.com" target="_blank" rel="noopener noreferrer" className="hover:text-signal-bright transition-colors">Docs</a>
            <a href="https://github.com/2TheMoom/fair-draw" target="_blank" rel="noopener noreferrer" className="hover:text-signal-bright transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </div>
  );
}
