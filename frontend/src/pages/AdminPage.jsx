import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, RefreshCw, Save, Search, ShieldCheck } from 'lucide-react';
import '../economy.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/admin`;
const TOKEN_KEY = 'frostfish-admin';
const CREW = [['rod', 'The Angler'], ['net', 'The Netter'], ['boat', 'The Captain']];
const short = a => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.detail || 'Request failed'); err.status = res.status; throw err; }
  return data;
}

export default function AdminPage() {
  const [token, setToken] = useState(sessionStorage.getItem(TOKEN_KEY));
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [stats, setStats] = useState(null);
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const signOut = useCallback(() => { api('/logout', { method: 'POST', token }).catch(() => {}); sessionStorage.removeItem(TOKEN_KEY); setToken(null); setSettings(null); }, [token]);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, st] = await Promise.all([api('/settings', { token }), api('/stats', { token })]);
      setSettings(s); setStats(st);
      setForm({ tokenAddress: s.tokenAddress, treasuryAddress: s.treasuryAddress, curveAddress: s.curveAddress || '', launchpadUrl: s.launchpadUrl, prices: { ...s.prices }, tokenUsdOverride: s.tokenUsdOverride ?? '' });
    } catch (e) { if (e.status === 401) signOut(); else setMsg({ type: 'err', text: e.message }); }
  }, [token, signOut]);
  useEffect(() => { load(); }, [load]);

  const login = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { const data = await api('/login', { method: 'POST', body: { password } }); sessionStorage.setItem(TOKEN_KEY, data.token); setToken(data.token); setPassword(''); }
    catch (err) { setMsg({ type: 'err', text: err.message }); }
    finally { setBusy(false); }
  };
  const resolve = async () => {
    setBusy(true); setMsg(null);
    try {
      const info = await api('/resolve', { method: 'POST', token, body: { url: link || form.launchpadUrl } });
      setForm(f => ({ ...f, tokenAddress: info.token_address, curveAddress: info.curve_address || '', launchpadUrl: info.launchpad_url }));
      setMsg({ type: 'ok', text: `Found ${info.symbol || 'token'} ${short(info.token_address)} · curve ${short(info.curve_address)}${info.price_usd ? ` · $${info.price_usd.toPrecision(3)}` : ''}. Review and save.` });
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
    finally { setBusy(false); }
  };
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const body = { ...form, curveAddress: form.curveAddress || null, tokenUsdOverride: form.tokenUsdOverride === '' ? null : Number(form.tokenUsdOverride), prices: Object.fromEntries(Object.entries(form.prices).map(([k, v]) => [k, Number(v)])) };
      const s = await api('/settings', { method: 'PUT', token, body });
      setSettings(s); setMsg({ type: 'ok', text: 'Settings saved. The game now uses the new addresses and prices.' });
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
    finally { setBusy(false); }
  };
  const field = (key, label, hint, props = {}) => <div className="admin-field"><label htmlFor={`admin-${key}`}>{label}</label><input id={`admin-${key}`} data-testid={`admin-${key}-input`} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} {...props}/>{hint && <small>{hint}</small>}</div>;

  if (!token) return <div className="admin-page" data-testid="admin-login-page"><form className="admin-card admin-login" onSubmit={login}>
    <h2><ShieldCheck size={14}/> Frostfish admin</h2>
    <div className="admin-field"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} data-testid="admin-password-input"/></div>
    {msg && <p className={`admin-msg ${msg.type}`} data-testid="admin-login-error" style={{ marginTop: 12 }}>{msg.text}</p>}
    <div className="admin-actions"><button className="admin-btn" disabled={busy || !password} data-testid="admin-login-button">{busy ? <Loader2 size={14} className="spin"/> : 'Sign in'}</button></div>
  </form></div>;

  return <div className="admin-page" data-testid="admin-page"><div className="admin-shell">
    <div className="admin-head"><div><h1>FROSTFISH · ADMIN</h1><p>Token, treasury, prices and launchpad for the in-game market.</p></div>
      <div className="admin-actions" style={{ marginTop: 0 }}><button className="admin-btn ghost" onClick={load} data-testid="admin-refresh-button"><RefreshCw size={14}/> Refresh</button><button className="admin-btn ghost" onClick={signOut} data-testid="admin-logout-button"><LogOut size={14}/> Sign out</button></div></div>
    {msg && <div className={`admin-msg ${msg.type}`} data-testid="admin-message">{msg.text}</div>}
    {settings && <div className="admin-card" data-testid="admin-live-card"><h2>Live status</h2><div className="admin-stat-grid">
      <div className="admin-stat"><small>Token</small><strong>{settings.symbol}</strong><span>{settings.decimals} decimals · {short(settings.tokenAddress)}</span></div>
      <div className="admin-stat"><small>Price</small><strong data-testid="admin-token-price">{settings.price ? `$${settings.price.token_usd.toPrecision(4)}` : '—'}</strong><span>{settings.price ? `${settings.price.source}${settings.price.eth_usd ? ` · ETH $${Math.round(settings.price.eth_usd)}` : ''}` : settings.priceError}</span></div>
      <div className="admin-stat"><small>Treasury {settings.symbol}</small><strong>{settings.treasuryTokenBalance == null ? '—' : settings.treasuryTokenBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong><span>{short(settings.treasuryAddress)}</span></div>
      <div className="admin-stat"><small>Treasury ETH (gas)</small><strong>{settings.treasuryEthBalance == null ? '—' : settings.treasuryEthBalance.toFixed(5)}</strong><span>{settings.claimEnabled ? <i className={`admin-badge ${settings.signerMatchesTreasury ? '' : 'warn'}`}>{settings.signerMatchesTreasury ? 'claims enabled' : `signer ${short(settings.signerAddress)} ≠ treasury`}</i> : <i className="admin-badge warn">claims off · add TREASURY_PRIVATE_KEY</i>}</span></div>
    </div></div>}
    {form && <form className="admin-card" onSubmit={save} data-testid="admin-settings-form"><h2>Economy settings</h2>
      <div className="admin-field" style={{ marginBottom: 14 }}><label htmlFor="admin-link">Ponsfamily launchpad link (auto-detects token CA and curve)</label>
        <div style={{ display: 'flex', gap: 8 }}><input id="admin-link" style={{ flex: 1 }} placeholder="https://ponsfamily.com/launchpad/0x…" value={link} onChange={e => setLink(e.target.value)} data-testid="admin-link-input"/><button type="button" className="admin-btn ghost" onClick={resolve} disabled={busy} data-testid="admin-resolve-button"><Search size={14}/> Read</button></div></div>
      <div className="admin-grid">
        {field('tokenAddress', 'Token contract (CA)', 'ERC-20 used for purchases and payouts.')}
        {field('treasuryAddress', 'Treasury wallet', 'Receives every purchase; pays claims.')}
        {field('curveAddress', 'Bonding curve contract', 'Price source (getReserves). Leave empty to use the Ponsfamily page price.')}
        {field('launchpadUrl', 'Launchpad link', 'Players with low balance are sent here.')}
        {CREW.map(([id, name]) => <div className="admin-field" key={id}><label htmlFor={`admin-price-${id}`}>{name} price (USD)</label><input id={`admin-price-${id}`} type="number" min="0.01" step="0.01" value={form.prices[id]} onChange={e => setForm(f => ({ ...f, prices: { ...f.prices, [id]: e.target.value } }))} data-testid={`admin-price-${id}-input`}/><small>Earns ${(Number(form.prices[id]) / 48 || 0).toFixed(4)} / hour</small></div>)}
        {field('tokenUsdOverride', 'Manual token price (USD, optional)', 'Overrides the live price when set. Leave empty for live pricing.', { type: 'number', min: '0', step: 'any', placeholder: 'live' })}
      </div>
      <div className="admin-actions"><button className="admin-btn" disabled={busy} data-testid="admin-save-button">{busy ? <Loader2 size={14} className="spin"/> : <Save size={14}/>} Save settings</button>{settings?.updatedAt && <small style={{ color: '#6f8c82' }}>Last saved {new Date(settings.updatedAt).toLocaleString()}</small>}</div>
    </form>}
    {stats && <div className="admin-card" data-testid="admin-stats-card"><h2>Activity</h2><div className="admin-stat-grid">
      <div className="admin-stat"><small>Wallets</small><strong data-testid="admin-wallet-count">{stats.wallets}</strong></div>
      <div className="admin-stat"><small>Purchases</small><strong data-testid="admin-purchase-count">{stats.purchaseCount}</strong><span>${stats.purchaseUsd.toFixed(2)} total</span></div>
      <div className="admin-stat"><small>Claims sent</small><strong data-testid="admin-claim-count">{stats.claimCount}</strong></div>
    </div>
      {!!stats.purchases.length && <table className="admin-table" data-testid="admin-purchases-table"><thead><tr><th>When</th><th>Wallet</th><th>Fisherman</th><th>USD</th><th>Tokens</th><th>Tx</th></tr></thead><tbody>
        {stats.purchases.map(p => <tr key={p.tx_hash}><td>{new Date(p.created_at).toLocaleString()}</td><td>{short(p.wallet_address)}</td><td>{p.character}</td><td>${p.price_usd}</td><td>{Math.round(p.amount_tokens).toLocaleString()}</td><td><a href={`https://robin.etherscan.io/tx/${p.tx_hash}`} target="_blank" rel="noreferrer">{short(p.tx_hash)}</a></td></tr>)}
      </tbody></table>}
      {!!stats.claims.length && <table className="admin-table" data-testid="admin-claims-table"><thead><tr><th>When</th><th>Wallet</th><th>USD</th><th>Tokens</th><th>Status</th><th>Tx</th></tr></thead><tbody>
        {stats.claims.map(c => <tr key={c.claim_id}><td>{new Date(c.created_at).toLocaleString()}</td><td>{short(c.wallet_address)}</td><td>${c.usd.toFixed(4)}</td><td>{Math.round(c.amount_tokens).toLocaleString()}</td><td>{c.status}{c.error ? ` · ${c.error.slice(0, 60)}` : ''}</td><td>{c.tx_hash ? <a href={`https://robin.etherscan.io/tx/${c.tx_hash}`} target="_blank" rel="noreferrer">{short(c.tx_hash)}</a> : '—'}</td></tr>)}
      </tbody></table>}
    </div>}
  </div></div>;
}
