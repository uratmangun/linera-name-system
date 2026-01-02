# Linera Smart Contracts

This folder contains Linera smart contracts for the LNS project. Each contract is organized as a separate subfolder following the standard Linera project structure.

## Structure

```
contracts/
├── README.md
├── linera_name_system/     # Domain registration contract
│   ├── Cargo.toml
│   ├── rust-toolchain.toml
│   └── src/
│       ├── lib.rs          # ABI definitions
│       ├── state.rs        # Application state
│       ├── contract.rs     # Contract logic (mutations)
│       └── service.rs      # Service logic (queries)
└── <future_contract>/      # Add more contracts here
```

## Creating a New Contract

Use the Linera CLI to scaffold a new contract:

```bash
cd contracts
linera project new my_new_contract
```

This creates the standard structure with all necessary files.

## Building Contracts

Build a specific contract:

```bash
cd contracts/linera_name_system
cargo build --release --target wasm32-unknown-unknown
```

The compiled WASM files will be in:
- `target/wasm32-unknown-unknown/release/linera_name_system_contract.wasm`
- `target/wasm32-unknown-unknown/release/linera_name_system_service.wasm`

## Deploying Contracts

Deploy using the Linera CLI:

```bash
linera project publish-and-create contracts/linera_name_system --json-argument "null"
```

Save the returned Application ID for frontend integration.

## Current Contracts

### linera_name_system

Domain registration system for .linera domains.

**Operations:**
- `Register { name }` - Register a new domain
- `Transfer { name, new_owner }` - Transfer domain ownership

**Queries:**
- `owner(name)` - Look up domain owner
- `isAvailable(name)` - Check if domain is available

**Mutations:**
- `register(name)` - Schedule domain registration
- `transfer(name, newOwner)` - Schedule ownership transfer
