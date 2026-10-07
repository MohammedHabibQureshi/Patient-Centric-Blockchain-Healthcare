# MetaMask Setup Guide

This guide covers configuring MetaMask for the Patient Healthcare Blockchain system on desktop and mobile devices.

## Network Configuration

### Network Details

| Parameter | Value |
|-----------|-------|
| **Network Name** | Patient Healthcare Blockchain |
| **RPC URL** | `http://YOUR_SERVER_LAN_IP:7548` |
| **Chain ID** | `1339` |
| **Currency Symbol** | `ETH` |
| **Block Explorer URL** | (leave empty) |

> **Important**: The RPC URL MUST use your server's LAN IP address (e.g., `192.168.1.100`), NOT `localhost` or `127.0.0.1`.

## Desktop Browser Setup

### 1. Install MetaMask Extension

1. Visit [metamask.io/download](https://metamask.io/download/)
2. Click "Install MetaMask for [Your Browser]"
3. Follow browser extension installation prompts
4. Create or import a wallet (for development, you'll import test accounts)

### 2. Add Custom Network

#### Method A: Automatic (Recommended)
1. Open the application at `http://YOUR_SERVER_LAN_IP:5173`
2. Click "Connect MetaMask" on login page
3. MetaMask will prompt to add the network automatically
4. Click "Approve" in MetaMask popup

#### Method B: Manual
1. Click MetaMask extension icon
2. Click network dropdown (shows "Ethereum Mainnet" by default)
3. Click "Add Network" → "Add a network manually"
4. Fill in the network details from the table above
5. Click "Save"

### 3. Import Test Accounts

**Get Private Keys from Ganache:**
When you run `npm run blockchain`, Ganache outputs 20 accounts with private keys:

```
Available Accounts
==================
(0) 0x90F8bf6A479f316Ea03399A3C254C30D9E1848F5 (10000 ETH)
(1) 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 (10000 ETH)
...

Private Keys
==================
(0) 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
(1) 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
...
```

**Import Process:**
1. Click MetaMask account icon (top right)
2. Click "Import Account"
3. Select "Private Key" as type
4. Paste private key for desired account
5. Click "Import"

**Account Roles:**
| Account | Role | Use For |
|---------|------|---------|
| Account 0 | Admin | Admin Dashboard |
| Accounts 1-10 | Patients | Patient Dashboard |
| Accounts 11-19 | Doctors | Doctor Dashboard |

### 4. Verify Connection

1. Open `http://YOUR_SERVER_LAN_IP:5173`
2. Click "Connect MetaMask"
3. Select the appropriate account for your role
4. Sign the authentication message
5. You should be redirected to the correct dashboard

## Mobile Setup (MetaMask Mobile)

### 1. Install MetaMask Mobile

- **iOS**: App Store → Search "MetaMask"
- **Android**: Google Play → Search "MetaMask"

### 2. Create/Import Wallet

1. Open MetaMask Mobile
2. Create new wallet or import existing
3. Secure your seed phrase!

### 3. Add Network on Mobile

#### Method A: QR Code (Easiest)
1. On desktop, open the application
2. Click network indicator → "Show QR Code"
3. On mobile: MetaMask → Settings → Networks → "Add Network" → Scan QR Code

#### Method B: Manual Entry
1. MetaMask Mobile → Settings (gear icon)
2. Networks → "Add Network"
3. Fill in the same network details as desktop
4. Save

### 4. Import Accounts on Mobile

**Option A: Sync from Desktop (Recommended)**
1. Desktop MetaMask → Settings → Advanced → "Sync with Mobile"
2. Scan QR code with mobile app
3. All accounts and networks sync automatically

**Option B: Manual Import**
1. Mobile MetaMask → Account menu → "Import Account"
2. Enter private key for each account
3. Repeat for each role needed

### 5. Access Application on Mobile

1. Ensure phone is on **same WiFi/LAN** as server
2. Open browser (Chrome/Safari)
3. Navigate to `http://YOUR_SERVER_LAN_IP:5173`
3. Tap "Connect MetaMask"
4. MetaMask Mobile will open for confirmation
5. Sign authentication message
6. Return to browser - should show dashboard

## Troubleshooting

### "Could not connect to network"
- Verify server LAN IP is correct
- Ensure Ganache is running (`npm run blockchain`)
- Check firewall allows port 7548
- Try `http://` not `https://`

### "Chain ID mismatch"
- Ensure Chain ID is exactly `1339` (decimal)
- Not `0x53B` (hex) - MetaMask expects decimal

### "RPC Error: Internal JSON-RPC error"
- Ganache may have restarted with different accounts
- Restart Ganache with `npm run blockchain`
- Re-import accounts if addresses changed

### "Transaction rejected"
- Ensure you're using correct account for role
- Admin actions need Account 0
- Patient actions need patient account (1-10)
- Doctor actions need doctor account (11-19)

### "Insufficient funds"
- Ganache gives 10000 ETH per account
- Check you're on correct network (Patient Healthcare Blockchain)
- Try switching networks away and back

### Mobile: "Cannot connect to server"
- Phone MUST be on same WiFi as server
- Use LAN IP, not localhost
- Check Windows Firewall allows ports 7548, 3000, 5173

### Mobile: MetaMask doesn't open
- Use Chrome on Android / Safari on iOS
- Ensure MetaMask Mobile is installed
- Try "Open in MetaMask" from browser menu

## Network Switching

If you use MetaMask for other networks:

1. **Desktop**: Click network dropdown → Select "Patient Healthcare Blockchain"
2. **Mobile**: Settings → Networks → Select the network

The app will detect wrong network and prompt to switch.

## Security Notes

⚠️ **Development Only:**
- Test private keys are exposed in Ganache output
- NEVER use these accounts for real value
- NEVER use development mnemonic in production
- This is a local/private network only

## Verification Checklist

After setup, verify:

- [ ] MetaMask shows "Patient Healthcare Blockchain" network
- [ ] Chain ID displays as 1339
- [ ] Admin account (0) imported and selected
- [ ] At least 1 patient account (1-10) imported
- [ ] At least 1 doctor account (11-19) imported
- [ ] Can connect to `http://SERVER_LAN_IP:5173`
- [ ] Can sign authentication message
- [ ] Redirected to correct dashboard for role
- [ ] Mobile device on same WiFi can access
- [ ] Mobile MetaMask connects and signs

## Quick Reference: Account Mapping

```
Ganache Account Index → Role → Dashboard
─────────────────────────────────────────
0                     → Admin → /dashboard
1-10                  → Patient → /patient
11-19                 → Doctor → /doctor
```

Each account has 10,000 ETH for unlimited testing transactions.