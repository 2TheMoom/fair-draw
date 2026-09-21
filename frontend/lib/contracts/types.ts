/**
 * TypeScript types for the GenLayer FairDraw contract
 */

export interface Round {
  created_at: string;
  entry_deadline: string;
  drawn: boolean;
  winner: string;
  winner_index: string;
  drand_round: string;
  randomness: string;
  entrant_count: string;
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  blockNumber?: number;
  [key: string]: any;
}
