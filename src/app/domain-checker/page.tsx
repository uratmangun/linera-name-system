"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { lineraAdapter, type LineraProvider } from "@/lib/linera-adapter";

const DomainCheckerApp = dynamic(
  () => import("@/components/domain-checker-app"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="text-zinc-500 dark:text-zinc-400">
          Loading Domain Checker...
        </div>
      </div>
    ),
  },
);

// Hardcoded application IDs
const DOMAIN_CHECKER_APP_ID =
  "d290e51ebcb758ae7fdd083407f8744aacd0a80dbf71f66a168fa7bcec21356e";
const LNS_APPLICATION_ID = process.env.NEXT_PUBLIC_LINERA_APPLICATION_ID || "";

export default function DomainCheckerPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [mounted, setMounted] = useState(false);
  const [chainConnected, setChainConnected] = useState(false);
  const [appConnected, setAppConnected] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registryChainId, setRegistryChainId] = useState<string | null>(null);
  const providerRef = useRef<LineraProvider | null>(null);

  useEffect(() => {
    setMounted(true);
    setChainConnected(lineraAdapter.isChainConnected());
    setAppConnected(lineraAdapter.isApplicationSet());
  }, []);

  // Auto-connect to Linera when wallet is connected
  const autoConnect = useCallback(async () => {
    if (!walletClient || !address || !DOMAIN_CHECKER_APP_ID || isAutoConnecting)
      return;
    if (chainConnected && appConnected) return;

    setIsAutoConnecting(true);
    setError(null);

    try {
      // Connect to Linera chain
      if (!chainConnected) {
        const provider = await lineraAdapter.connect(walletClient, address);
        providerRef.current = provider;
        setChainConnected(true);
      }

      // Connect to domain_checker application
      if (!appConnected && DOMAIN_CHECKER_APP_ID) {
        await lineraAdapter.setApplication(DOMAIN_CHECKER_APP_ID);
        setAppConnected(true);
      }
    } catch (err) {
      console.error("Auto-connect failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to auto-connect to Linera",
      );
    } finally {
      setIsAutoConnecting(false);
    }
  }, [walletClient, address, chainConnected, appConnected, isAutoConnecting]);

  useEffect(() => {
    if (mounted && isConnected && walletClient && address && !chainConnected) {
      autoConnect();
    }
  }, [
    mounted,
    isConnected,
    walletClient,
    address,
    chainConnected,
    autoConnect,
  ]);

  // Set registry chain ID from LNS application ID
  // The application ID format is <chain_id (64 chars)><bytecode_id>
  // So we can extract the registry chain ID directly without querying
  useEffect(() => {
    if (appConnected && LNS_APPLICATION_ID && LNS_APPLICATION_ID.length >= 64) {
      // Extract chain ID from LNS application ID (first 64 hex chars)
      const extractedChainId = LNS_APPLICATION_ID.slice(0, 64);
      setRegistryChainId(extractedChainId);
    }
  }, [appConnected]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!isConnected || !address) {
      lineraAdapter.reset();
      providerRef.current = null;
      setChainConnected(false);
      setAppConnected(false);
      setRegistryChainId(null);
      setError(null);
    }
  }, [isConnected, address]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-black sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Cross-Chain Domain Query Test
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Test the Request-Response pattern for querying domain ownership
              across chains
            </p>
          </div>
          <ConnectButton />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Connection Status */}
        {!isConnected ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              Please connect your wallet to use the Domain Checker
            </p>
          </div>
        ) : !chainConnected || !appConnected ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              {isAutoConnecting
                ? "Connecting to Linera..."
                : "Waiting for connection..."}
            </p>
          </div>
        ) : (
          <>
            {/* App Info */}
            <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="mb-2 font-semibold text-zinc-800 dark:text-zinc-200">
                Application Info
              </h2>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Domain Checker App ID:</span>{" "}
                  <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
                    {DOMAIN_CHECKER_APP_ID.slice(0, 16)}...
                    {DOMAIN_CHECKER_APP_ID.slice(-8)}
                  </code>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">LNS App ID:</span>{" "}
                  <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
                    {LNS_APPLICATION_ID
                      ? `${LNS_APPLICATION_ID.slice(0, 16)}...${LNS_APPLICATION_ID.slice(-8)}`
                      : "Not set"}
                  </code>
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Registry Chain ID:</span>{" "}
                  <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
                    {registryChainId
                      ? `${registryChainId.slice(0, 16)}...${registryChainId.slice(-8)}`
                      : "Fetching..."}
                  </code>
                </p>
              </div>
            </div>

            {/* Domain Checker Component */}
            {registryChainId ? (
              <DomainCheckerApp
                domainCheckerAppId={DOMAIN_CHECKER_APP_ID}
                registryChainId={registryChainId}
              />
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Fetching registry chain ID...
                </p>
              </div>
            )}
          </>
        )}

        {/* Back Link */}
        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            ← Back to LNS Main App
          </a>
        </div>
      </div>
    </div>
  );
}
