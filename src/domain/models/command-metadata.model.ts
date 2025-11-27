import type { Rank } from "../value-objects/rank.vo";

export interface CommandMetadata {
  readonly name: string;
  readonly aliases: string[];
  readonly minRank: Rank;
  readonly description: string;
  readonly usage: string;
}
