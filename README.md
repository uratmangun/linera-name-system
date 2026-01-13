AKINDO PAGE: https://app.akindo.io/communities/4er3MmDL0u22gOd86/products/0nro2Nv3eT00jOzZ

YOUTUBE DEMO: https://www.youtube.com/watch?v=sRjxlZCsGb4

# Linera Name System (LNS)

The **Linera Name System (LNS)** is a decentralized identity identity protocol built on the [Linera](https://linera.io) microchain network. It allows users to register, manage, and trade human-readable `.linera` domains, replacing complex cryptographic addresses (Chain IDs) with memorable names.

Built with **Next.js 16**, **Dynamic** for wallet abstraction, and **Rust** smart contracts compiled to WASM.

## 🚀 Features

*   **Decentralized Identity**: Register unique `.linera` domains compliant with the Linera protocol.
*   **Microchain Architecture**: Each user operates on their own chain, ensuring infinite scalability and low latency.
*   **Cross-Chain Resolution**: Includes a `domain_checker` contract that allows *any* chain to query the Registry chain using the Request-Response pattern.
*   **Marketplace**: Native buy/sell functionality. List domains for sale in LINERA tokens.
*   **Dynamic Wallet**: Seamless onboarding via Email, Socials, or Web3 wallets using [Dynamic.xyz](https://dynamic.xyz).
*   **Zero-Config WASM**: The Linera client runs directly in the browser via WebAssembly for instant state queries.

## 🏗 Architecture

The system consists of two main smart contracts:

1.  **`linera_name_system` (Registry)**:
    *   The "Server" contract.
    *   Stores the authoritative state of all domains, owners, expiration dates, and metadata.
    *   Handles registration, transfers, and marketplace logic.
2.  **`domain_checker` (Client)**:
    *   The "Client" contract deployed on user chains.
    *   Implements the cross-chain interface.
    *   Sends `RequestCheckOwnership` messages to the Registry and receives `OwnershipResponse` callbacks.

## 🛠 Project Structure

```bash
├── contracts/
│   ├── linera_name_system/ # Registry Logic (Rust)
│   └── domain_checker/     # Cross-chain Client Logic (Rust)
├── src/
│   ├── app/                # Next.js Frontend
│   ├── components/         # React Components
│   └── lib/                # Linera Adapter & Utilities
├── scripts/                # TypeScript Automation Scripts (Deploy/Build)
└── public/                 # Static Assets
```

---

## 💻 Local Development

### Prerequisites

*   **Node.js** (v20+) & **Bun** (v1.x)
*   **Rust** & **Wasm Target** (`rustup target add wasm32-unknown-unknown`)
*   **Linera CLI** (v0.15.x)
*   **Podman** or Docker (for running local Linera net)

### 1. Setup Environment

```bash
cp .env.example .env.local
```
Update `.env.local` with your Dynamic Environment ID.

### 2. Build Contracts

Compile the Rust contracts to WebAssembly using `cargo`:

```bash
cd contracts/linera_name_system
cargo build --release --target wasm32-unknown-unknown
cd ../domain_checker
cargo build --release --target wasm32-unknown-unknown
cd ../..
```

### 3. Initialize Wallet & Deploy

Initialize your local Linera wallet and deploy the contracts to your local network (or testnet) using the `linera` CLI:

```bash
# Initialize wallet (if not already done)
linera wallet init

# Create a clean chain for the registry
linera wallet show
# (Save the Chain ID)

# Deploy Registry Contract
linera project publish-and-create contracts/linera_name_system --json-argument "null"

# Deploy Checker Contract
linera project publish-and-create contracts/domain_checker --json-argument "null"
```


### 4. Run Frontend

Start the Next.js development server:

```bash
bun dev
```

Visit `http://localhost:3000`.

---

## ☁️ Deployment Guide (VPS & Podman)

This guide explains how to deploy the Linera service and contracts to a VPS (e.g., Ubuntu) and run them as a background service.

### 1. Transfer Wallet to VPS

To interact with the deployed contracts or query Chain IDs from your VPS, you need your Linera wallet. Use `scp` to copy it securely:

```bash
# Replace user@your-vps-ip with your actual credentials
scp -r ~/.linera_wallet user@your-vps-ip:/home/user/
```

### 2. Run Linera Service via Podman Quadlet

We use **Podman Quadlet** to run the Linera service (or any background task) as a systemd service.

1.  **SSH into your VPS**:
    ```bash
    ssh user@your-vps-ip
    ```

2.  **Create the Quadlet File**:
    Create a file at `~/.config/containers/systemd/linera.container`:

    ```ini
    [Unit]
    Description=Linera Network Service
    After=network-online.target

    [Container]
    # Use the official Linera toolchain image or your custom image
    Image=docker.io/linera/linera-toolchain:latest
    # Mount your wallet
    Volume=%h/.linera_wallet:/root/.linera_wallet
    # Command to run (example: running a local net or service)
    Exec=linera net up
    # Expose ports if needed
    PublishPort=8080:8080

    [Service]
    Restart=always

    [Install]
    WantedBy=default.target
    ```

3.  **Start the Service**:
    ```bash
    # Reload systemd to pick up the new file
    systemctl --user daemon-reload
    
    # Start the service
    systemctl --user start linera
    
    # Enable auto-start on boot
    systemctl --user enable linera
    ```

4.  **Check Status**:
    ```bash
    systemctl --user status linera
    podman ps
    ```

### 3. Querying Chain ID on VPS

Once your wallet is on the VPS, you can use the Linera CLI (inside the container or installed globally) to check your details:

```bash
# If installed globally
linera wallet show

# Or via Podman
podman exec -it linera-container linera wallet show
```

The output will display your **Public Key** and **Chain ID**.

---

## 🤖 LLMs.txt API Documentation

This project serves an `llms.txt` file at the root, which contains the **Linera Name System API Documentation** in plain text.

*   **Location**: `/llms.txt`.
*   **Purpose**: This file allows Large Language Models (LLMs) to easily ingest and understand how to **resolve `.linera` domains** programmatically. It documents the REST API endpoints, response formats, and provides code examples in various languages (JS, Python, Go).
*   **Context**: Use this when you want an LLM to write code for your application that integrates with LNS (e.g., "Write a Python script to check if 'alice.linera' is available using the LNS API at https://linera-name-system.vercel.app/llms.txt").

To see the content, visit `/llms.txt` in your browser.

## 📜 Scripts Reference

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun build` | Build for production |
| `bun start` | Start production server |
| `bun lint` | Run Biome linter |
| `bun format` | Run Biome formatter |

## License

MIT
