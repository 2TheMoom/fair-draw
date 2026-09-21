"use client";

import { useState } from "react";
import { useWallet } from "@/lib/genlayer/wallet";
import { GENLAYER_NETWORK } from "@/lib/genlayer/client";
import { error, userRejected } from "@/lib/utils/toast";
import { AddressDisplay } from "./AddressDisplay";

const METAMASK_INSTALL_URL = "https://metamask.io/download/";

function SeqLine({ k, v, tone = "signal" }: { k: string; v: string; tone?: "signal" | "select" | "muted" }) {
  const color = tone === "signal" ? "text-signal-bright" : tone === "select" ? "text-select" : "text-muted-foreground";
  const dots = ".".repeat(Math.max(4, 42 - k.length));
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2.5 text-[0.76rem] items-baseline">
      <span className="text-muted-foreground overflow-hidden whitespace-nowrap">
        {k}
        <span className="opacity-40"> {dots}</span>
      </span>
      <span className={`font-semibold whitespace-nowrap ${color}`}>{v}</span>
    </div>
  );
}

export function AccountPanel() {
  const {
    address,
    isConnected,
    isMetaMaskInstalled,
    isOnCorrectNetwork,
    isLoading,
    connectWallet,
    disconnectWallet,
    switchWalletAccount,
  } = useWallet();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleConnect = async () => {
    if (!isMetaMaskInstalled) return;
    try {
      setIsConnecting(true);
      await connectWallet();
    } catch (err: any) {
      if (err.message?.includes("rejected")) {
        userRejected("Connection cancelled");
      } else {
        error("Failed to connect wallet", { description: err.message || "Check your MetaMask and try again." });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      setIsSwitching(true);
      await switchWalletAccount();
    } catch (err: any) {
      if (!err.message?.includes("rejected")) {
        error("Failed to switch account", { description: err.message || "Please try again." });
      } else {
        userRejected("Account switch cancelled");
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const providerStatus: "signal" | "select" = isMetaMaskInstalled ? "signal" : "select";
  const providerLabel = isMetaMaskInstalled ? "METAMASK" : "NOT FOUND";
  const networkStatus: "signal" | "select" | "muted" = !isConnected ? "muted" : isOnCorrectNetwork ? "signal" : "select";
  const networkLabel = !isConnected ? "PENDING" : isOnCorrectNetwork ? `${GENLAYER_NETWORK.chainName.toUpperCase()} ✓` : "WRONG NETWORK";
  const handshakeStatus: "signal" | "select" | "muted" = isConnected ? "signal" : isConnecting ? "select" : "muted";
  const handshakeLabel = isConnected ? "COMPLETE" : isConnecting ? "AWAITING SIGNATURE" : "NOT STARTED";

  return (
    <div className="relative">
      {isConnected ? (
        <button
          type="button"
          onClick={() => setIsPanelOpen((v) => !v)}
          className="link-chip"
        >
          <span className="pulse-dot" />
          LINKED // <AddressDisplay address={address} maxLength={10} />
        </button>
      ) : (
        <button type="button" onClick={() => setIsPanelOpen((v) => !v)} className="link-ghost" disabled={isLoading}>
          [ LINK WALLET ]
        </button>
      )}

      {isPanelOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsPanelOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] border border-border bg-background p-4">
            <span className="bracket tl" style={{ width: 10, height: 10 }} />
            <span className="bracket tr" style={{ width: 10, height: 10 }} />
            <span className="bracket bl" style={{ width: 10, height: 10 }} />
            <span className="bracket br" style={{ width: 10, height: 10 }} />

            <div className="label mb-3">Wallet Link</div>

            <div className="flex flex-col gap-2">
              <SeqLine k="PROVIDER DETECTED" v={providerLabel} tone={providerStatus} />
              <SeqLine k="NETWORK CHECK" v={networkLabel} tone={networkStatus} />
              <SeqLine k="HANDSHAKE" v={handshakeLabel} tone={handshakeStatus} />
              <SeqLine k="SIGNAL LOCK" v={isConnected ? "0x" + (address || "").slice(2, 10) + "…" : "—"} tone={isConnected ? "signal" : "muted"} />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {!isMetaMaskInstalled && (
                <button
                  type="button"
                  onClick={() => window.open(METAMASK_INSTALL_URL, "_blank")}
                  className="link-ghost w-full text-center"
                >
                  [ INSTALL METAMASK ]
                </button>
              )}
              {isMetaMaskInstalled && !isConnected && (
                <button type="button" onClick={handleConnect} disabled={isConnecting} className="link-ghost w-full text-center" style={{ borderStyle: "solid", color: "var(--signal-bright)", borderColor: "var(--primary)" }}>
                  {isConnecting ? "[ AWAITING SIGNATURE… ]" : "[ CONNECT METAMASK ]"}
                </button>
              )}
              {isConnected && (
                <>
                  <button type="button" onClick={handleSwitchAccount} disabled={isSwitching} className="link-ghost w-full text-center">
                    {isSwitching ? "[ SWITCHING… ]" : "[ SWITCH ACCOUNT ]"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { disconnectWallet(); setIsPanelOpen(false); }}
                    className="link-ghost w-full text-center"
                    style={{ color: "var(--destructive)", borderColor: "var(--destructive)" }}
                  >
                    [ DISCONNECT ]
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
