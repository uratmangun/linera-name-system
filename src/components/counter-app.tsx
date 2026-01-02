"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { lineraAdapter, type LineraProvider } from "@/lib/linera-adapter";

interface BlockLog {
    height: number;
    hash: string;
}

interface DomainQueryResult {
    Owner?: string | null;
    IsAvailable?: boolean;
}

export default function CounterApp() {
    const { primaryWallet } = useDynamicContext();
    const isLoggedIn = useIsLoggedIn();
    const [mounted, setMounted] = useState(false);
    const [chainId, setChainId] = useState<string | null>(null);
    const [logs, setLogs] = useState<BlockLog[]>([]);
    const [error, setError] = useState<string | null>(null);

    const providerRef = useRef<LineraProvider | null>(null);
    const [chainConnected, setChainConnected] = useState(false);
    const [appConnected, setAppConnected] = useState(false);
    const [isAutoConnecting, setIsAutoConnecting] = useState(false);

    // Domain registration state
    const [domainName, setDomainName] = useState("");
    const [searchResult, setSearchResult] = useState<DomainQueryResult | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    const applicationId = process.env.NEXT_PUBLIC_LINERA_APPLICATION_ID || "";

    useEffect(() => {
        setMounted(true);
        setChainConnected(lineraAdapter.isChainConnected());
        setAppConnected(lineraAdapter.isApplicationSet());
    }, []);

    // Auto-connect to Linera when wallet is connected
    const autoConnect = useCallback(async () => {
        if (!primaryWallet || !applicationId || isAutoConnecting) return;
        if (chainConnected && appConnected) return;

        setIsAutoConnecting(true);
        setError(null);

        try {
            // Connect to Linera chain
            if (!chainConnected) {
                const provider = await lineraAdapter.connect(primaryWallet);
                providerRef.current = provider;
                setChainConnected(true);
                setChainId(provider.chainId);
            }

            // Connect to application
            if (!appConnected && applicationId) {
                await lineraAdapter.setApplication(applicationId);
                setAppConnected(true);
            }
        } catch (err) {
            console.error("Auto-connect failed:", err);
            setError(err instanceof Error ? err.message : "Failed to auto-connect to Linera");
        } finally {
            setIsAutoConnecting(false);
        }
    }, [primaryWallet, applicationId, chainConnected, appConnected, isAutoConnecting]);

    useEffect(() => {
        if (mounted && isLoggedIn && primaryWallet && !chainConnected) {
            autoConnect();
        }
    }, [mounted, isLoggedIn, primaryWallet, chainConnected, autoConnect]);

    // Reset Linera adapter when Dynamic wallet disconnects
    useEffect(() => {
        if (!isLoggedIn || !primaryWallet) {
            lineraAdapter.reset();
            providerRef.current = null;
            setChainConnected(false);
            setAppConnected(false);
            setChainId(null);
            setLogs([]);
            setError(null);
            setSearchResult(null);
        }
    }, [isLoggedIn, primaryWallet]);

    useEffect(() => {
        if (!chainConnected || !providerRef.current) return;
        const client = providerRef.current.client;
        if (!client || typeof client.onNotification !== 'function') return;

        const handler = (notification: unknown) => {
            const newBlock: BlockLog | undefined = (
                notification as { reason: { NewBlock: BlockLog } }
            )?.reason?.NewBlock;
            if (!newBlock) return;
            setLogs((prev) => [newBlock, ...prev]);
        };

        try {
            client.onNotification(handler);
        } catch (err) {
            console.error('Failed to set notification handler:', err);
        }
        return () => { };
    }, [chainConnected]);

    async function handleCheckDomain() {
        if (!domainName.trim()) {
            setError("Please enter a domain name");
            return;
        }
        setIsSearching(true);
        setError(null);
        setSearchResult(null);

        try {
            // GraphQL query for availability
            const result = await lineraAdapter.queryApplication<{
                data?: { isAvailable: boolean };
                errors?: Array<{ message: string }>;
            }>({
                query: `query { isAvailable(name: "${domainName.trim()}") }`
            });
            if (result.errors?.length) {
                throw new Error(result.errors[0].message);
            }
            setSearchResult({ IsAvailable: result.data?.isAvailable });
        } catch (err) {
            console.error("Failed to check domain:", err);
            setError(err instanceof Error ? err.message : "Failed to check domain availability");
        } finally {
            setIsSearching(false);
        }
    }

    async function handleRegisterDomain() {
        if (!domainName.trim()) {
            setError("Please enter a domain name");
            return;
        }
        setIsRegistering(true);
        setError(null);

        try {
            // Call the register mutation - the service will schedule the operation
            const result = await lineraAdapter.queryApplication<{
                data?: { register: boolean };
                errors?: Array<{ message: string }>;
            }>({
                query: `mutation { register(name: "${domainName.trim()}") }`
            });

            if (result.errors?.length) {
                throw new Error(result.errors[0].message);
            }

            if (result.data?.register) {
                // Registration operation scheduled successfully
                setSearchResult({ IsAvailable: false });
                setError(null);
                // Show success message
                alert(`Domain ${domainName.trim()}.linera registration submitted! It may take a moment to be confirmed.`);
            }
        } catch (err) {
            console.error("Failed to register domain:", err);
            setError(err instanceof Error ? err.message : "Failed to register domain");
        } finally {
            setIsRegistering(false);
        }
    }

    async function handleLookupOwner() {
        if (!domainName.trim()) {
            setError("Please enter a domain name");
            return;
        }
        setIsSearching(true);
        setError(null);
        setSearchResult(null);

        try {
            // GraphQL query for owner
            const result = await lineraAdapter.queryApplication<{
                data?: { owner: string | null };
                errors?: Array<{ message: string }>;
            }>({
                query: `query { owner(name: "${domainName.trim()}") }`
            });
            if (result.errors?.length) {
                throw new Error(result.errors[0].message);
            }
            setSearchResult({ Owner: result.data?.owner });
        } catch (err) {
            console.error("Failed to lookup owner:", err);
            setError(err instanceof Error ? err.message : "Failed to lookup domain owner");
        } finally {
            setIsSearching(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
            <div className="w-full max-w-3xl px-6 py-12">
                <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-900">
                    <div className="mb-8 flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Linera Name System</h1>
                        <DynamicWidget />
                    </div>

                    <div className="mb-8">
                        <p className="mb-2 text-zinc-600 dark:text-zinc-400">
                            Register your unique .linera domain on the Linera blockchain.
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Connect your wallet to get started. Your chain will be automatically claimed from the testnet faucet.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                            <p className="text-red-500 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Connection Status */}
                    {mounted && isAutoConnecting && (
                        <div className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-sky-50 p-4 dark:bg-sky-900/20">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
                            <p className="text-sky-600 dark:text-sky-400">Connecting to Linera testnet...</p>
                        </div>
                    )}

                    {mounted && !isLoggedIn && (
                        <div className="mb-6 rounded-lg bg-zinc-100 p-6 text-center dark:bg-zinc-800">
                            <p className="text-zinc-500 dark:text-zinc-400">
                                Please connect your wallet using the button above to get started.
                            </p>
                        </div>
                    )}

                    {/* Domain Registration UI */}
                    {chainConnected && appConnected && (
                        <div className="space-y-6">
                            <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-800">
                                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                                    Search & Register Domain
                                </h2>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={domainName}
                                            onChange={(e) => setDomainName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                            placeholder="Enter domain name"
                                            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 pr-20 text-zinc-900 placeholder-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                                            .linera
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCheckDomain}
                                        disabled={isSearching || !domainName.trim()}
                                        className="flex-1 rounded-lg bg-zinc-200 px-4 py-2 font-medium text-zinc-800 transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                    >
                                        {isSearching ? "Checking..." : "Check Availability"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLookupOwner}
                                        disabled={isSearching || !domainName.trim()}
                                        className="flex-1 rounded-lg bg-zinc-200 px-4 py-2 font-medium text-zinc-800 transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                    >
                                        Lookup Owner
                                    </button>
                                </div>

                                {searchResult && (
                                    <div className="mt-4 rounded-lg bg-white p-4 dark:bg-zinc-900">
                                        {searchResult.IsAvailable !== undefined && (
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-zinc-900 dark:text-white">
                                                        {domainName}.linera
                                                    </p>
                                                    <p className={searchResult.IsAvailable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                                        {searchResult.IsAvailable ? "Available!" : "Already registered"}
                                                    </p>
                                                </div>
                                                {searchResult.IsAvailable && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRegisterDomain}
                                                        disabled={isRegistering}
                                                        className="rounded-lg bg-sky-600 px-6 py-2 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {isRegistering ? "Registering..." : "Register"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {searchResult.Owner !== undefined && (
                                            <div>
                                                <p className="font-medium text-zinc-900 dark:text-white">
                                                    {domainName}.linera
                                                </p>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Owner:</p>
                                                <p className="break-all font-mono text-sm text-zinc-700 dark:text-zinc-300">
                                                    {searchResult.Owner || "Not registered"}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Chain Info */}
                    {chainConnected && (
                        <div className="mt-8 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-700">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-sm text-zinc-600 dark:text-zinc-400">Connected to Linera Testnet</span>
                            </div>
                            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Chain ID:{" "}
                                <code className="break-all rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                    {chainId || "…"}
                                </code>
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-500">
                                Application ID:{" "}
                                <code className="break-all font-mono text-xs">
                                    {applicationId.slice(0, 16)}...{applicationId.slice(-8)}
                                </code>
                            </p>

                            {logs.length > 0 && (
                                <>
                                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Recent Blocks</h3>
                                    <ul className="max-h-32 space-y-1 overflow-y-auto">
                                        {logs.slice(0, 5).map((log, index) => (
                                            <li key={`${log.hash}-${index}`} className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800">
                                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{log.height}</span>:{" "}
                                                <span className="text-zinc-500 dark:text-zinc-500">{log.hash.slice(0, 16)}...</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
