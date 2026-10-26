# Frostfish — PRD

## Original problem statement (TR, summarized)
Move the repo https://github.com/Dostarki/fishesrh1 to Emergent (FastAPI + MongoDB). Remove X, the Early Access campaign and the points system entirely. What remains is the game plus wallet sign-in through RainbowKit with a SIWE signature on Robinhood Chain Mainnet (4663, RPC https://rpc.mainnet.chain.robinhood.com). Wallet required, no guest mode; wrong network locks the game. Game sessions per wallet in MongoDB. Nonce single-use, domain + chainId checked. Signed session lasts 24 hours.

### Iteration 2 (2026-06) — real token economy
- Demo TOKEN economy removed. Fishermen are bought with the real $FISHESRH ERC-20 (CA 0x098e9efbf4d65cbfc27130c1bf8a09b007659dbf) at $1 (Angler) / $10 (Netter) / $50 (Captain); tokens are transferred to the treasury 0x603a26e0745aE579ad0F931307a386ddC3DD096F. User signs the transfer in the wallet; backend verifies the tx receipt (Transfer log from wallet → treasury, amount ≥ 98% of quote, tx hash single-use) before granting the fisherman.
- Insufficient balance → player is sent to https://ponsfamily.com/launchpad/<CA>.
- Token USD price = Ponsfamily bonding-curve `getReserves()` (curve 0x138b88…53e9) × ETH/USD (CoinGecko, fallback Ponsfamily page `quoteUsd`); if graduated/unavailable → Ponsfamily page `priceUsd`; admin manual override possible.
- Earnings shown per HOUR; every fisherman pays back its price in 48h (hourly_usd = price/48). Earnings tracked in USD, paid in tokens at live price via Claim (min $0.05). Purchases are permanent and stored in MongoDB (`purchases`, worker on `games`).
- Hidden admin panel `/errorlogin404495959`, password `FISHESPRO4488` (env ADMIN_PASSWORD): edit token CA, treasury, curve, launchpad link, prices, manual price; paste a Ponsfamily link → "Read" auto-fills CA + curve. Shows live price, treasury balances, purchases, claims.
- Bug fixes: MetaMask SDK crash `(0, import_openapi_fetch.default) is not a function` (CRA had no loader for `.cjs` → craco alias to ESM build); SIWE signature now requested automatically right after wallet connect; sign-out also disconnects the wallet. Wallet addresses upserted into `wallets` on every login.

## Architecture
- backend/server.py: SIWE auth, /api/config, /api/purchase/quote|confirm, /api/claim, /api/claims, /api/game, /api/leaderboard. backend/admin.py: /api/admin/* (login w/ lockout, settings, resolve, stats). backend/pricing.py: settings + price cache. backend/chain.py: raw JSON-RPC (eth_call, receipts, signed ERC-20 transfer for claims). backend/game.py: economy (grant, fish_value_usd, public_state). backend/db.py: Mongo client.
- frontend: index.js routes (`/` game, `/errorlogin404495959` AdminPage); hooks/useEconomy.js (config, wagmi balanceOf/transfer); hooks/useGame.js (quote/confirmPurchase/claim); components/InfoDialogs.jsx (Market/Inventory/Guide); GameChrome.jsx TopHUD; PlayGate auto-sign; pages/AdminPage.jsx; economy.css.
- Collections: games, wallets, wallet_sessions, wallet_challenges, purchase_quotes, purchases, claims, settings (economy singleton), admin_sessions, admin_attempts.

## Env (backend/.env)
MONGO_URL, DB_NAME, CORS_ORIGINS, ROBINHOOD_CHAIN_ID=4663, APP_URL, ROBINHOOD_RPC_URL, ADMIN_PASSWORD, TREASURY_PRIVATE_KEY (optional; enables Claim — collected via secrets).

## Testing
- iteration_1 (2026-06): 18/18 backend pytest + full frontend flow with mock wallet passed. Real on-chain purchase/claim not executed in tests (test wallet has no funds).

## Backlog
- P0: Set TREASURY_PRIVATE_KEY (secret) so Claim works; treasury needs ETH for gas + FISHESRH balance. User to test a real $1 purchase.
- P1: Add preview/production domains in the Reown dashboard (user action).
- P1: Post-graduation pricing: after the curve graduates, price comes from the Ponsfamily page; consider DEX pool pricing.
- P2: Claim history UI in inventory; purchase receipts (explorer links) in inventory.
