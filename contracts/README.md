# CDP Shield Smart Contracts

Smart contracts for CDP Shield protocol on BASE network.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
```

## Development

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Run tests with gas report
REPORT_GAS=true npx hardhat test

# Run coverage
npx hardhat coverage
```

## Deployment

### BASE Sepolia Testnet

```bash
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### BASE Mainnet

```bash
npx hardhat run scripts/deploy.ts --network base
```

## Verify Contract

```bash
npx hardhat verify --network baseSepolia DEPLOYED_CONTRACT_ADDRESS
```

## Architecture

```
contracts/
├── core/          # Core protocol contracts
├── interfaces/    # Contract interfaces
└── mocks/         # Mock contracts for testing
```
