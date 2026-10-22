# Economy

All Crossline coins, instruments, holdings, bets and supply purchases are local practice state. The browser creates a world with 1,000 credits and zero career detentions. Exiting/reloading resets it. There is no account, saved balance, database, payment connection, withdrawal, real-money conversion or shared market. Browser state can be edited by its owner; it is never authoritative evidence for a future server.

## Implemented local rules

Source A's four fictional instruments remain: order, chaos, repair demand and media demand. `marketTick` in `src/game/engine.ts` derives target prices from tension, violent actors, property damage and violence rate, adds seeded bounded noise and keeps an 80-point price history. Prices clamp to 3–400. Purchases/sales require a known instrument, a nonzero safe-integer quantity of at most 1,000 in magnitude, sufficient cash or holdings, and an active round. There is no short-selling. Executing a trade nudges the quoted price by quantity×0.15; this is a practice mechanic, not a realistic exchange.

The watcher HUD exposes buy/sell and supply buttons. `fund` requires a positive safe-integer amount, sufficient local balance and fewer than 20 truck/crate entities. The HUD uses 100-credit purchases. It creates a simulated faction supply truck; delivery/collection affect physical supplies. Protester funding also raises morale. This is an implemented simulation effect, not a bank transfer or persistent donation.

`placeBet` retains three engine contracts with a 60-second horizon: a protester stays free, a police officer records a new detention, or a previously peaceful protester becomes violent. Target faction/state, stake, balance, contract type and a maximum of 100 bet records are checked. Odds are derived locally from tension at placement. Settlement only processes records with `status=open` after their deadline; it changes status before crediting winnings, preventing repeat settlement within that world. Wins pay rounded stake×odds including returned stake. This is local idempotency only.

The UI exposes a 50-credit bet on a selected protester staying free or a selected officer making a detention. The violence contract remains an engine rule without a dedicated HUD button. Source B's whole-match offer catalogue was not retained. Session role earnings and `earned` statistics are displayed/accounted locally and do not become persistent career rewards. At round end, still-open bets are marked refunded and their stakes return to the session wallet; holdings are liquidated once at their closing local quotes.

## Known limits

Trade profit is a cash-flow statistic, not a complete realized/unrealized accounting ledger; use `portfolioValue` alongside cash to value holdings. Trades can influence the same local price used for valuation, so the prototype does not guarantee manipulation-resistant pricing. Credits may be fractional after trades. Removed target histories can be unavailable when a contract resolves. Session holdings disappear on exit with the rest of practice state; no persistent settlement ledger exists. These limits must be resolved before balances persist or markets span players.

## Why source persistence was excluded

Source A allows public profile IDs and client-submitted increments. Source B additionally trusts arbitrary client odds, `creditsDelta`, score/progression and settlement win flags. Neither authenticates ownership or provides transactionally idempotent settlement. B's read-then-write betting debit can lose concurrent debits; repeated match submissions mint progression and balances. Its PostgreSQL tables do not fix these trust violations. The integrated root deliberately does not expose those source mutation APIs.

## Requirements before persistent virtual currency

An authenticated authority must own player balances, match membership, input validation, accepted offers, placement deadlines, outcomes and settlement. Use server-issued transaction/idempotency IDs, a ledger, atomic conditional debits and uniqueness constraints for settlement; reject arbitrary client balance/score increments. Compute progression from the same authoritative event stream. Clients may request actions and display predictions, but cannot report a win or mint credits. Test concurrent requests, retries, disconnects, duplicate finishes and reconciliation before enabling persistent rewards.

No real-money gambling system is planned by this initialization. Do not add payments as a side effect of implementing virtual markets.
