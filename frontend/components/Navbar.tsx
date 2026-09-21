"use client";

import { AccountPanel } from "./AccountPanel";
import { LogoFull } from "./Logo";
import { GENLAYER_CHAIN_ID, GENLAYER_NETWORK } from "@/lib/genlayer/client";

// "GenLayer Bradbury Testnet" -> "Bradbury" for the compact HUD readout.
const NETWORK_SHORT_NAME = GENLAYER_NETWORK.chainName
  .replace(/^GenLayer\s+/i, "")
  .replace(/\s+Testnet$/i, "");

export function Navbar() {
  return (
    <div className="hud-row flex justify-between items-start gap-4 flex-wrap px-5">
      <div>
        <div className="label">Target Acquired</div>
        <LogoFull size="sm" className="mt-1.5" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="label">Network</div>
        <div className="flex items-center gap-1.5 font-mono text-[0.66rem] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 6px var(--primary)" }} />
          {NETWORK_SHORT_NAME} &middot; {GENLAYER_CHAIN_ID}
        </div>
        <AccountPanel />
      </div>
    </div>
  );
}
