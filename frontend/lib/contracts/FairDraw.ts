import { createClient } from "genlayer-js";
import { getGenLayerChain } from "../genlayer/chains";
import type { Round } from "./types";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";

/**
 * genlayer-js decodes Python dicts (and dataclasses) as JS Map instances,
 * keyed by field name. This flattens one level of the Map into a plain
 * object.
 */
function toPlainObject(raw: any): Record<string, any> {
  const entries = raw instanceof Map ? Array.from(raw.entries()) : Object.entries(raw ?? {});
  const obj: Record<string, any> = {};
  for (const [key, value] of entries) {
    obj[key] = value;
  }
  return obj;
}

function decodeRound(raw: any): Round {
  const obj = toPlainObject(raw);
  return {
    created_at: String(obj.created_at ?? "0"),
    entry_deadline: String(obj.entry_deadline ?? "0"),
    drawn: Boolean(obj.drawn),
    winner: String(obj.winner ?? ""),
    winner_index: String(obj.winner_index ?? "0"),
    drand_round: String(obj.drand_round ?? "0"),
    randomness: String(obj.randomness ?? ""),
    entrant_count: String(obj.entrant_count ?? "0"),
  };
}

/**
 * FairDraw contract class - a verifiable commit-then-reveal raffle with
 * no LLM anywhere. open_round/enter/draw are the only write methods;
 * none of them move any value.
 */
class FairDraw {
  private contractAddress: `0x${string}`;
  private client: any;
  private rpcUrl?: string;

  constructor(contractAddress: string, address?: string | null, rpcUrl?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.rpcUrl = rpcUrl;

    const config: any = { chain: getGenLayerChain() };
    if (address) config.account = address as `0x${string}`;
    if (rpcUrl) config.endpoint = rpcUrl;

    this.client = createClient(config);
  }

  updateAccount(address: string): void {
    const config: any = { chain: getGenLayerChain(), account: address as `0x${string}` };
    if (this.rpcUrl) config.endpoint = this.rpcUrl;
    this.client = createClient(config);
  }

  private async estimateFees(
    functionName: string,
    args: unknown[],
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(this.client, { address: this.contractAddress, functionName, args }, level);
  }

  async getRound(roundId: string): Promise<Round | null> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress, functionName: "get_round", args: [roundId],
      });
      return decodeRound(result);
    } catch {
      return null;
    }
  }

  async getEntrants(roundId: string): Promise<string[]> {
    const result: any = await this.client.readContract({
      address: this.contractAddress, functionName: "get_entrants", args: [roundId],
    });
    return Array.isArray(result) ? result.map(String) : [];
  }

  async hasEntered(roundId: string, wallet: string): Promise<boolean> {
    const result = await this.client.readContract({
      address: this.contractAddress, functionName: "has_entered", args: [roundId, wallet],
    });
    return Boolean(result);
  }

  private async submitWrite(
    functionName: string,
    args: unknown[],
    feePreset?: FeePresetEstimate,
    onSubmitted?: (txHash: string) => void
  ): Promise<string> {
    const fees = feePresetToTransactionFees(feePreset);
    let txHash: string;
    try {
      txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName,
        args,
        value: BigInt(0),
        ...(fees ? { fees } : {}),
      });
    } catch (error) {
      console.error(`Error calling ${functionName}:`, error);
      throw new Error(`Failed to submit the ${functionName} transaction. Please try again.`);
    }

    onSubmitted?.(txHash);

    try {
      await this.client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" as any, retries: 40, interval: 5000 });
      return txHash;
    } catch (error) {
      console.error(`Error confirming ${functionName} transaction:`, error);
      throw new Error(
        `Transaction ${txHash} was submitted but confirmation timed out. It may still complete - check the explorer.`
      );
    }
  }

  async estimateOpenRoundFees(roundId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("open_round", [roundId], level);
  }

  async openRound(roundId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("open_round", [roundId], feePreset, onSubmitted);
  }

  async estimateEnterFees(roundId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("enter", [roundId], level);
  }

  async enter(roundId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("enter", [roundId], feePreset, onSubmitted);
  }

  async estimateDrawFees(roundId: string, level: FeePresetLevel = "standard") {
    return this.estimateFees("draw", [roundId], level);
  }

  async draw(roundId: string, feePreset?: FeePresetEstimate, onSubmitted?: (txHash: string) => void) {
    return this.submitWrite("draw", [roundId], feePreset, onSubmitted);
  }
}

export default FairDraw;
