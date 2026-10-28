import { character, updateCharacter } from "../app/store";
import { COINS, type Coin, NO_COINS, goldValue, withCoin } from "../engine/coins";
import { type UiKey, ui } from "../i18n/ui";
import { unitLocale } from "../i18n/units";
import { Panel } from "./sheet/parts";
import { useHoldRepeat } from "./useHoldRepeat";

/** One counter per kind of coin: a number to type, and one up or down with the buttons. */
export function Coins() {
  const hold = useHoldRepeat();
  const coins = character.value.coins ?? NO_COINS;
  const set = (coin: Coin, amount: number) =>
    updateCharacter((d) => {
      d.coins = withCoin(d.coins, coin, amount);
    });
  // The buttons read the amount when pressed, so quick taps all count.
  const step = (coin: Coin, by: number) =>
    updateCharacter((d) => {
      d.coins = withCoin(d.coins, coin, (d.coins?.[coin] ?? 0) + by);
    });
  const total = goldValue(coins);

  return (
    <div class="coins">
      <div class="coin-row">
        {COINS.map((coin) => {
          const name = ui(`coin.${coin}.name` as UiKey);
          return (
            <div class="coin" key={coin}>
              <label htmlFor={`coin-${coin}`} title={name}>
                {ui(`coin.${coin}` as UiKey)}
              </label>
              <div class="coin-controls">
                <button
                  type="button"
                  class="hold"
                  aria-label={ui("coin.less", { coin: name })}
                  disabled={coins[coin] <= 0}
                  {...hold(() => step(coin, -1))}
                >
                  −
                </button>
                <input
                  id={`coin-${coin}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={coins[coin]}
                  onInput={(e) => set(coin, Number.parseInt(e.currentTarget.value, 10))}
                />
                <button
                  type="button"
                  class="hold"
                  aria-label={ui("coin.more", { coin: name })}
                  {...hold(() => step(coin, 1))}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p class="muted">
        {ui("coin.total", {
          gp: total.toLocaleString(unitLocale.value, { maximumFractionDigits: 2 }),
        })}
      </p>
    </div>
  );
}

/** The coins as a panel of their own, for the Play screen. */
export function CoinsPanel() {
  return (
    <Panel title={ui("coin.title")}>
      <Coins />
    </Panel>
  );
}
