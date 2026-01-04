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
├── domain_checker/         # Cross-chain domain query test contract
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

Domain registration system for .linera domains with expiration, marketplace, and DNS-like value storage.

**Operations:**
- `Register { name }` - Register a new domain (1 year expiration)
- `Transfer { name, new_owner }` - Transfer domain ownership
- `Extend { name, years }` - Extend domain registration by years (1-10)
- `SetPrice { name, price }` - Set domain price for sale (0 to remove from sale)
- `Buy { name }` - Buy a domain that is for sale
- `SetValue { name, value }` - Set DNS-like value for a domain

**Queries:**
- `owner(name)` - Look up domain owner
- `isAvailable(name)` - Check if domain is available (not registered or expired)
- `domain(name)` - Get full domain information
- `resolve(name)` - Resolve domain to its value (DNS-like lookup)
- `registryChainId()` - Get registry chain ID
- `isRegistryChain()` - Check if current chain is registry
- `currentChainId()` - Get current chain ID
- `allDomains()` - List all registered domains
- `domainsForSale()` - List domains that are for sale
- `domainsByOwner(owner)` - List domains owned by address

**Mutations:**
- `register(name)` - Schedule domain registration
- `transfer(name, newOwner)` - Schedule ownership transfer
- `extend(name, years)` - Extend domain registration
- `setPrice(name, price)` - Set domain price for sale
- `buy(name)` - Buy a domain
- `setValue(name, value)` - Set DNS-like value

**Features:**
- **Expiration**: Domains expire after 1 year (can be extended)
- **Marketplace**: Domains can be bought/sold by setting price
- **DNS-like Values**: Domains can store arbitrary text (URL, IP, etc.)
- **Expired Domains**: Can be re-registered if expired

### domain_checker

Test contract demonstrating cross-chain state queries using the Request-Response pattern. This contract queries domain ownership information from the LNS registry on another chain.

**Purpose:**
This contract tests whether smart contracts can query state from another chain. Since Linera uses per-chain state isolation, cross-chain queries must be asynchronous via message passing.

**How it works:**
1. User calls `CheckOwnership` operation on domain_checker contract
2. Contract sends `RequestCheckOwnership` message to LNS registry chain
3. LNS registry processes the request and sends `OwnershipResponse` back
4. domain_checker receives the response and stores it in local state
5. UI polls the contract state to retrieve the cached result

**Operations:**
- `CheckOwnership { name, registry_chain_id }` - Query domain ownership from LNS registry

**Messages:**
- `RequestCheckOwnership { name, requester_chain }` - Sent to LNS registry
- `OwnershipResponse { name, owner, is_available, expiration }` - Response from LNS registry

**Queries:**
- `domainQuery(name)` - Get cached query result for a domain
- `isQueryPending(name)` - Check if a query is waiting for response
- `pendingQueryTimestamp(name)` - Get timestamp when query was initiated
- `allCachedQueries()` - List all cached domain query results
- `currentChainId()` - Get current chain ID

**Building:**
```bash
cd contracts/domain_checker
cargo build --release --target wasm32-unknown-unknown
```

**Deploying:**
```bash
linera project publish-and-create contracts/domain_checker --json-argument "null"
```

**Note:** This contract requires the LNS registry to be deployed first, as it sends messages to the registry chain.
