@echo off
cd /d D:\projects\Patient-Centric based Blockchain\patient-healthcare-blockchain
npx ganache --server.host 0.0.0.0 --server.port 7548 --chain.chainId 1339 --chain.networkId 1339 --wallet.totalAccounts 20 --wallet.mnemonic "test test test test test test test test test test test junk" --miner.blockTime 0 --database.dbPath "./blockchain/ganache-data" --logging.verbose