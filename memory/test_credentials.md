# Test Credentials

## Player auth (SIWE, no passwords)
Auth = SIWE wallet signature on Robinhood Chain Mainnet (chain 4663).
Throwaway test wallet (no funds): address 0x91b02ECb55671655eEb68E98F9c231296B4C16Ae
private key e719d708568092b905a4eae3f9b793d8de36691e87515321ae3cd48807d49d65
Signing helper: `/root/.venv/bin/python3 /app/tests/sign.py <privkey> <0xhex-message>` -> signature.
API flow: POST /api/auth/challenge (header `Origin: https://frostfish-emerge.preview.emergentagent.com`, body {address, chainId: 4663})
-> sign `message` with eth_account `Account.sign_message(encode_defunct(text=message))`
-> POST /api/auth/verify {address, chainId, nonce, message, signature} -> `token` -> `Authorization: Bearer <token>` (24h).
Browser: inject a mock EIP-1193 `window.ethereum` (see /app/tests/mock_wallet.md) and pick "Browser Wallet" in RainbowKit.

## Admin panel
URL: /errorlogin404495959
Password: FISHESPRO4488  (env ADMIN_PASSWORD) -> POST /api/admin/login {password} -> bearer token (12h). 5 wrong attempts per IP = 15 min lockout.
