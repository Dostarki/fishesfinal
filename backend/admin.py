"""Hidden admin panel API: password login, economy settings, launchpad resolver, stats."""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

import chain
import pricing
from db import db
from game import CHARACTERS

router = APIRouter(prefix='/api/admin')
ADMIN_TTL = timedelta(hours=12)
MAX_ATTEMPTS, LOCK_MINUTES = 5, 15


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt):
    return dt.replace(tzinfo=timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def client_ip(request: Request):
    forwarded = request.headers.get('x-forwarded-for', '')
    return forwarded.split(',')[0].strip() if forwarded else (request.client.host if request.client else 'unknown')


class LoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class SettingsRequest(BaseModel):
    tokenAddress: str
    treasuryAddress: str
    curveAddress: str | None = None
    launchpadUrl: str = Field(max_length=300)
    prices: dict[str, float]
    tokenUsdOverride: float | None = Field(default=None, ge=0)


class ResolveRequest(BaseModel):
    url: str = Field(min_length=10, max_length=300)


async def require_admin(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Admin sign-in required.')
    session = await db.admin_sessions.find_one(
        {'token_hash': hashlib.sha256(authorization[7:].encode()).hexdigest(), 'expires_at': {'$gt': utcnow()}})
    if not session:
        raise HTTPException(401, 'Admin session expired. Sign in again.')
    return session


@router.post('/login')
async def login(body: LoginRequest, request: Request):
    ip = client_ip(request)
    attempt = await db.admin_attempts.find_one({'ip': ip})
    if attempt and attempt.get('locked_until') and attempt['locked_until'] > utcnow():
        raise HTTPException(429, f'Too many attempts. Try again in {LOCK_MINUTES} minutes.')
    expected = os.environ['ADMIN_PASSWORD']
    if not hmac.compare_digest(body.password.encode(), expected.encode()):
        count = (attempt or {}).get('count', 0) + 1
        update = {'$set': {'count': count, 'last_at': utcnow()}}
        if count >= MAX_ATTEMPTS:
            update['$set'].update(locked_until=utcnow() + timedelta(minutes=LOCK_MINUTES), count=0)
        await db.admin_attempts.update_one({'ip': ip}, update, upsert=True)
        raise HTTPException(401, 'Wrong password.')
    await db.admin_attempts.delete_one({'ip': ip})
    token = secrets.token_urlsafe(40)
    expires_at = utcnow() + ADMIN_TTL
    await db.admin_sessions.insert_one({'token_hash': hashlib.sha256(token.encode()).hexdigest(), 'expires_at': expires_at, 'ip': ip})
    return {'token': token, 'expiresAt': iso(expires_at)}


@router.post('/logout')
async def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith('Bearer '):
        await db.admin_sessions.delete_one({'token_hash': hashlib.sha256(authorization[7:].encode()).hexdigest()})
    return {'ok': True}


async def settings_view():
    settings = await pricing.get_settings(db, fresh=True)
    meta = await pricing.token_meta(settings)
    view = {'tokenAddress': settings['token_address'], 'treasuryAddress': settings['treasury_address'],
            'curveAddress': settings.get('curve_address'), 'launchpadUrl': settings['launchpad_url'],
            'prices': settings['prices'], 'tokenUsdOverride': settings.get('token_usd_override'),
            'symbol': meta['symbol'], 'decimals': meta['decimals'], 'updatedAt': settings.get('updated_at'),
            'claimEnabled': bool(os.environ.get('TREASURY_PRIVATE_KEY'))}
    try:
        view['price'] = await pricing.token_price(settings)
    except Exception as e:
        view['price'] = None
        view['priceError'] = str(e)
    try:
        view['treasuryTokenBalance'] = (await chain.erc20_balance(settings['token_address'], settings['treasury_address'])) / 10 ** meta['decimals']
        view['treasuryEthBalance'] = (await chain.eth_balance(settings['treasury_address'])) / 1e18
    except Exception:
        view['treasuryTokenBalance'] = view['treasuryEthBalance'] = None
    key = os.environ.get('TREASURY_PRIVATE_KEY')
    if key:
        try:
            signer = chain.treasury_signer_address(key)
            view['signerAddress'] = signer
            view['signerMatchesTreasury'] = signer.lower() == settings['treasury_address'].lower()
        except Exception:
            view['signerAddress'] = None
            view['signerMatchesTreasury'] = False
    return view


@router.get('/settings')
async def get_settings(_=Depends(require_admin)):
    return await settings_view()


@router.put('/settings')
async def put_settings(body: SettingsRequest, _=Depends(require_admin)):
    try:
        token = pricing.validate_address(body.tokenAddress, 'Token contract address')
        treasury = pricing.validate_address(body.treasuryAddress, 'Treasury address')
        curve = pricing.validate_address(body.curveAddress, 'Curve address') if body.curveAddress else None
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    prices = {}
    for cid in CHARACTERS:
        value = body.prices.get(cid)
        if value is None or value <= 0:
            raise HTTPException(422, f'Price for {CHARACTERS[cid]["name"]} must be greater than 0.')
        prices[cid] = round(float(value), 2)
    if not body.launchpadUrl.startswith('http'):
        raise HTTPException(422, 'Launchpad link must start with http(s).')
    await pricing.save_settings(db, {'token_address': token, 'treasury_address': treasury, 'curve_address': curve,
                                     'launchpad_url': body.launchpadUrl.strip(), 'prices': prices,
                                     'token_usd_override': body.tokenUsdOverride or None})
    return await settings_view()


@router.post('/resolve')
async def resolve(body: ResolveRequest, _=Depends(require_admin)):
    try:
        return await pricing.resolve_launchpad(body.url)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    except Exception:
        raise HTTPException(502, 'Could not read the Ponsfamily page. Check the link and try again.') from None


@router.get('/stats')
async def stats(_=Depends(require_admin)):
    purchases = await db.purchases.find({}, {'_id': 0}).sort('created_at', -1).limit(50).to_list(50)
    claims = await db.claims.find({}, {'_id': 0}).sort('created_at', -1).limit(50).to_list(50)
    totals = await db.purchases.aggregate([{'$group': {'_id': None, 'usd': {'$sum': '$price_usd'}, 'count': {'$sum': 1}}}]).to_list(1)
    return {'wallets': await db.wallets.count_documents({}), 'purchaseCount': (totals[0]['count'] if totals else 0),
            'purchaseUsd': (totals[0]['usd'] if totals else 0), 'claimCount': await db.claims.count_documents({'status': 'sent'}),
            'purchases': purchases, 'claims': claims}


async def ensure_indexes():
    await db.admin_sessions.create_index('expires_at', expireAfterSeconds=0)
    await db.admin_attempts.create_index('ip', unique=True)
