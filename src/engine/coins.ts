/** The coins a character carries, to keep track of money. Nothing else reads them. */
export interface Coins {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export const COINS = ["cp", "sp", "ep", "gp", "pp"] as const;
export type Coin = (typeof COINS)[number];

export const NO_COINS: Coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

/** What a coin is worth in gold pieces. */
const IN_GOLD: Record<Coin, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

/** All the coins together, as gold pieces. */
export const goldValue = (coins: Coins | undefined): number =>
  COINS.reduce((sum, coin) => sum + (coins?.[coin] ?? 0) * IN_GOLD[coin], 0);

/** How many coins make a pound. */
export const COINS_PER_POUND = 50;

/** The weight of all the coins, in pounds. */
export const coinWeight = (coins: Coins | undefined): number =>
  COINS.reduce((sum, coin) => sum + (coins?.[coin] ?? 0), 0) / COINS_PER_POUND;

/** The coins with one kind set to a whole number of at least zero. */
export function withCoin(coins: Coins | undefined, coin: Coin, amount: number): Coins {
  const whole = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  return { ...NO_COINS, ...coins, [coin]: whole };
}
