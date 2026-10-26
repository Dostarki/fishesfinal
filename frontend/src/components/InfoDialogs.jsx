import { useEffect, useState } from 'react';
import { Fish, Store, Coins, Footprints, ArrowUpRight, Sparkles, Moon, Package, Trophy, Crown, Users, Zap, Loader2, ExternalLink, Clock, Wallet, Gift } from 'lucide-react';
import { GameDialog } from './GameDialog';
import { CharacterArt } from './CharacterArt';
import { CREW } from '../lib/gameData';
import { fmtUsd, fmtTokens, usdToTokens } from '../hooks/useEconomy';

const ownedBy = (game, id) => (game?.workers || []).filter(w => w.character === id).length;

export const MarketDialog = ({ open, onClose, game, config, wallet, onBuy, buying, pending }) => {
  const symbol = config?.symbol || 'TOKEN';
  const balanceUsd = wallet.balance != null && config?.tokenUsd ? wallet.balance * config.tokenUsd : null;
  return <GameDialog open={open} onClose={onClose} id="market" title="Fishermen Market" subtitle={`Hire fishermen with ${symbol}. Each one pays itself back in ${config?.paybackHours ?? 48} hours, then keeps earning.`} className="shop-dialog">
    <div className="shop-wallet" data-testid="shop-wallet">
      <div className="shop-balance" data-testid="shop-balance"><Wallet size={16}/> <strong data-testid="shop-token-balance">{fmtTokens(wallet.balance)}</strong> {symbol}{balanceUsd != null && <span data-testid="shop-balance-usd">≈ {fmtUsd(balanceUsd)}</span>}</div>
      <div className="shop-price" data-testid="shop-token-price">{config?.tokenUsd ? <>1 {symbol} = ${config.tokenUsd.toPrecision(3)} <small>· live {config.priceSource}</small></> : 'Fetching live price…'}</div>
    </div>
    <div className="shop-grid">{CREW.map(c => {
      const owned = ownedBy(game, c.id), priceUsd = config?.prices?.[c.id], tokens = usdToTokens(priceUsd, config);
      const afford = wallet.balance != null && tokens != null && wallet.balance >= tokens;
      const isBuying = buying === c.id;
      return <div className={`shop-card shop-${c.id}`} key={c.id} data-testid={`shop-card-${c.id}`}>
        <div className="shop-art"><CharacterArt type={c.id}/><span className="owned-badge" data-testid={`owned-count-${c.id}`}>OWNED ×{owned}</span></div>
        <div className="shop-role">{c.role}</div>
        <h3 data-testid={`shop-name-${c.id}`}>{c.name}</h3>
        <div className="shop-yield"><Sparkles size={16}/><strong data-testid={`shop-hourly-${c.id}`}>{fmtUsd(config?.hourlyUsd?.[c.id], 4)}</strong><span>/ hour<br/><em data-testid={`shop-hourly-tokens-${c.id}`}>≈ {fmtTokens(usdToTokens(config?.hourlyUsd?.[c.id] ?? 0, config))} {symbol}/h</em></span></div>
        <ul className="shop-facts">
          <li><Clock size={13}/> Pays back in {config?.paybackHours ?? 48}h</li>
          <li><Fish size={13}/> {c.limit} fish per shift · {c.capacity} per trip</li>
          <li><Moon size={13}/> 2 min hammock nap</li>
        </ul>
        <button className={`game-btn shop-buy ${afford || wallet.balance == null ? 'btn-gold' : 'btn-teal'}`} data-testid={`buy-${c.id}-button`} disabled={!!buying || !config?.tokenUsd || !!pending} onClick={() => onBuy(c.id, afford)}>
          <span className="btn-icon">{isBuying ? <Loader2 size={18} className="spin"/> : afford || wallet.balance == null ? <Coins size={18}/> : <ExternalLink size={18}/>}</span>
          <span className="btn-label">{isBuying ? 'CONFIRMING…' : afford || wallet.balance == null ? `HIRE · ${fmtUsd(priceUsd, 0)}` : `GET ${symbol}`}<small data-testid={`buy-${c.id}-tokens`}>{tokens != null ? `≈ ${fmtTokens(tokens)} ${symbol}` : '…'}</small></span>
        </button>
        {!afford && wallet.balance != null && tokens != null && <p className="shop-short" data-testid={`shop-short-${c.id}`}>Need {fmtTokens(tokens - wallet.balance)} more {symbol} · buy on the launchpad</p>}
      </div>;
    })}</div>
    {pending && <p className="shop-pending" data-testid="shop-pending">Finishing your last purchase on-chain… <Loader2 size={12} className="spin"/></p>}
    {!!game?.events?.length && <><div className="ledger-heading"><span>MARKET ACTIVITY</span><span>{game.fish_sold} fish sold · {game.customers_served} customers</span></div>
      <div className="activity-list" data-testid="market-activity">{game.events.slice(0, 6).map((event, i) => <div className="activity-item" key={`${event.at}-${i}`} data-testid={`activity-${i}`}><span className={`activity-icon ${event.kind}`}><ArrowUpRight size={15}/></span><span>{event.text}</span><time>{new Date(event.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time></div>)}</div></>}
  </GameDialog>;
};

const STATUS_CLASS = { Fishing: 'st-fish', Delivering: 'st-deliver', Returning: 'st-return', Sleeping: 'st-sleep' };
export const InventoryDialog = ({ open, onClose, game, config, onMarket, onClaim, busy }) => {
  const workers = game?.workers || [];
  const symbol = config?.symbol || 'TOKEN';
  const claimable = game?.claimable_usd ?? 0;
  const canClaim = config?.claimEnabled && claimable >= (config?.minClaimUsd ?? 0.05);
  return <GameDialog open={open} onClose={onClose} id="inventory" title="Inventory" subtitle="Every fisherman you own, live from the island. They stay with your wallet forever." className="inventory-dialog">
    <div className="inv-earnings" data-testid="inventory-earnings">
      <div><small>CLAIMABLE</small><strong data-testid="inventory-claimable">{fmtUsd(claimable, 4)}</strong><span>≈ {fmtTokens(usdToTokens(claimable, config))} {symbol}</span></div>
      <div><small>PER HOUR</small><strong data-testid="inventory-hourly">{fmtUsd(game?.hourly_usd, 4)}</strong><span>{workers.length} fishermen · {fmtUsd(game?.invested_usd, 0)} invested</span></div>
      <div><small>LIFETIME</small><strong data-testid="inventory-lifetime">{fmtUsd(game?.earned_usd, 4)}</strong><span>{fmtUsd(game?.claimed_usd, 4)} claimed</span></div>
      <button className="game-btn btn-gold inv-claim" data-testid="inventory-claim-button" disabled={!canClaim || busy} onClick={onClaim} title={config?.claimEnabled ? '' : 'Claims open soon'}>
        <span className="btn-icon">{busy ? <Loader2 size={18} className="spin"/> : <Gift size={18}/>}</span><span className="btn-label">CLAIM<small>{config?.claimEnabled ? `min ${fmtUsd(config?.minClaimUsd ?? 0.05)}` : 'coming soon'}</small></span>
      </button>
    </div>
    <div className="inventory-summary">{CREW.map(c => <div key={c.id} className={`inv-sum inv-${c.id}`} data-testid={`inventory-summary-${c.id}`}><CharacterArt type={c.id} small/><div><strong>×{ownedBy(game, c.id)}</strong><span>{c.name}</span></div></div>)}</div>
    {workers.length ? <div className="inventory-list" data-testid="inventory-list">{workers.map(w => <div className="inv-row" key={w.uid} data-testid={`inventory-worker-${w.uid}`}>
      <CharacterArt type={w.character} small/>
      <div className="inv-main"><div className="inv-top"><strong>{w.name} #{w.uid}</strong><span className={`inv-status ${STATUS_CLASS[w.status]}`} data-testid={`inventory-status-${w.uid}`}>{w.status === 'Sleeping' ? `Sleeping · ${w.rest_left}s` : w.status}</span></div>
        <div className="inv-energy"><Zap size={12}/><div className="energy-track"><i style={{ width: `${w.energy}%` }} className={w.energy > 50 ? 'e-high' : w.energy > 20 ? 'e-mid' : 'e-low'}/></div><span data-testid={`inventory-energy-${w.uid}`}>{w.energy}%</span></div>
        <div className="inv-meta"><span><Fish size={12}/> {w.caught} caught</span><span><Coins size={12}/> +{fmtUsd(w.earned_usd, 4)}</span><span><Sparkles size={12}/> {fmtUsd(w.hourly_usd, 4)}/h</span><span><Trophy size={12}/> paid {fmtUsd(w.price_usd, 0)}</span></div>
      </div>
    </div>)}</div> : <div className="empty-market" data-testid="inventory-empty">No fishermen yet. <button className="text-button" onClick={onMarket} data-testid="inventory-open-market">Visit the market</button></div>}
  </GameDialog>;
};

export const LeaderboardDialog = ({ open, onClose, load }) => {
  const [data, setData] = useState(null);
  useEffect(() => { if (open) load().then(setData).catch(() => setData({ entries: [], you: null })); }, [open, load]);
  return <GameDialog open={open} onClose={onClose} id="leaderboard" title="Leaderboard" subtitle="Top islanders by lifetime earnings." className="leaderboard-dialog">
    {!data ? <div className="empty-market" data-testid="leaderboard-loading">Counting the catch…</div> : <>
      <div className="lb-list" data-testid="leaderboard-list">{data.entries.map(e => <div className={`lb-row ${e.you ? 'lb-you' : ''} lb-rank-${e.rank}`} key={e.rank} data-testid={`leaderboard-row-${e.rank}`}>
        <span className="lb-rank">{e.rank <= 3 ? <Crown size={16}/> : null}{e.rank}</span><strong>{e.name}{e.you && <em>YOU</em>}</strong><span className="lb-workers"><Users size={12}/> {e.workers}</span><span className="lb-rewards">{fmtUsd(e.rewards, 4)}</span>
      </div>)}</div>
      {data.you && <div className="lb-me" data-testid="leaderboard-you"><Trophy size={18}/> Your rank <strong>#{data.you.rank}</strong> · {fmtUsd(data.you.rewards, 4)} earned</div>}
    </>}
  </GameDialog>;
};

export const GuideDialog = ({ open, onClose, config }) => <GameDialog open={open} onClose={onClose} id="guide" title="A fisherman's field guide" subtitle="Life moves a little slower in Frosthaven." className="guide-dialog">
  <div className="guide-steps">{[[Store,'01','Hire at the market',`Pay with ${config?.symbol || 'the game token'} on Robinhood Chain: $1 for an Angler, $10 for a Netter, $50 for a Captain. Fishermen belong to your wallet forever.`],[Footprints,'02','Catch, carry, earn','Fishermen fill their bucket, carry it to the market and earn for every fish delivered. Every fisherman pays back its price in 48 hours, then keeps earning.'],[Moon,'03','Claim your earnings',`Earnings are tracked in USD and paid out in ${config?.symbol || 'tokens'} at the live price when you claim from your inventory.`]].map(([Icon,n,title,description])=><div className="guide-step" key={n} data-testid={`guide-step-${n}`}><span className="guide-icon"><Icon size={22}/></span><div><span className="step-number">{n}</span><h3>{title}</h3><p>{description}</p></div></div>)}</div>
  <p className="guide-footnote" data-testid="guide-notice">Purchases are real on-chain token transfers to the Frostfish treasury and cannot be refunded. Earnings accrue while the island is open.</p>
</GameDialog>;
