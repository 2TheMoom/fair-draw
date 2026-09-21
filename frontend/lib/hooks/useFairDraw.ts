"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import FairDraw from "../contracts/FairDraw";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { success, error, configError } from "../utils/toast";
import type { Round } from "../contracts/types";

export function useFairDrawContract(): FairDraw | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const rpcUrl = getStudioUrl();

  const contract = useMemo(() => {
    if (!contractAddress) {
      configError(
        "Setup Required",
        "Contract address not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.",
        { label: "Setup Guide", onClick: () => window.open("/docs/setup", "_blank") }
      );
      return null;
    }
    return new FairDraw(contractAddress, address, rpcUrl);
  }, [contractAddress, address, rpcUrl]);

  return contract;
}

export function useRound(roundId: string) {
  const contract = useFairDrawContract();

  return useQuery<Round | null, Error>({
    queryKey: ["round", roundId],
    queryFn: () => (contract ? contract.getRound(roundId) : Promise.resolve(null)),
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract && !!roundId,
  });
}

export function useEntrants(roundId: string) {
  const contract = useFairDrawContract();

  return useQuery<string[], Error>({
    queryKey: ["entrants", roundId],
    queryFn: () => (contract ? contract.getEntrants(roundId) : Promise.resolve([])),
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract && !!roundId,
  });
}

export function useHasEntered(roundId: string, wallet: string | null) {
  const contract = useFairDrawContract();

  return useQuery<boolean, Error>({
    queryKey: ["hasEntered", roundId, wallet],
    queryFn: () => (contract && wallet ? contract.hasEntered(roundId, wallet) : Promise.resolve(false)),
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract && !!roundId && !!wallet,
  });
}

function useWriteAction(
  action: (contract: FairDraw, roundId: string, feePreset: any, onSubmitted: (h: string) => void) => Promise<string>,
  successMessage: { title: string; description: string },
  errorTitle: string
) {
  const contract = useFairDrawContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (roundId: string) => {
      if (!contract) throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.");
      if (!address) throw new Error("Wallet not connected. Please connect your wallet first.");
      setIsPending(true);
      setPendingTxHash(null);
      return action(contract, roundId, undefined, setPendingTxHash);
    },
    onSuccess: (_data, roundId) => {
      queryClient.invalidateQueries({ queryKey: ["round", roundId] });
      queryClient.invalidateQueries({ queryKey: ["entrants", roundId] });
      queryClient.invalidateQueries({ queryKey: ["hasEntered", roundId] });
      setIsPending(false);
      success(successMessage.title, { description: successMessage.description });
    },
    onError: (err: any) => {
      console.error(errorTitle, err);
      setIsPending(false);
      error(errorTitle, { description: err?.message || "Please try again." });
    },
  });

  return {
    ...mutation,
    isPending,
    pendingTxHash,
    clearPendingTx: () => setPendingTxHash(null),
    run: mutation.mutate,
  };
}

export function useOpenRound() {
  return useWriteAction(
    (c, id, fee, cb) => c.openRound(id, fee, cb),
    { title: "Round opened!", description: "Entries are now open for 5 minutes." },
    "Failed to open round"
  );
}

export function useEnter() {
  return useWriteAction(
    (c, id, fee, cb) => c.enter(id, fee, cb),
    { title: "Entered!", description: "You're in the round." },
    "Failed to enter"
  );
}

export function useDraw() {
  return useWriteAction(
    (c, id, fee, cb) => c.draw(id, fee, cb),
    { title: "Drawn!", description: "The winner is now on-chain." },
    "Failed to draw"
  );
}
