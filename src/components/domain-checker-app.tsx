"use client";

import { useCallback, useEffect, useState } from "react";
import { useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { lineraAdapter } from "@/lib/linera-adapter";

interface DomainCheckerQueryResult {
  name: string;
  owner: string | null;
  isAvailable: boolean;
  expiration: number | null;
  queryTimestamp: number;
}

interface Props {
  // The application ID of the domain_checker contract
  domainCheckerAppId: string;
  // The registry chain ID where LNS is deployed
  registryChainId: string;
}

/**
 * Component to test cross-chain domain queries via the domain_checker smart contract.
 *
 * This demonstrates the Request-Response pattern:
 * 1. User triggers CheckOwnership operation on domain_checker contract
 * 2. domain_checker sends RequestCheckOwnership message to LNS registry chain
 * 3. LNS registry responds with OwnershipResponse message
 * 4. domain_checker stores the result in its state
 * 5. UI polls for the result
 */
export default function DomainCheckerApp({
  domainCheckerAppId,
  registryChainId,
}: Props) {
  const { primaryWallet } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  const [mounted, setMounted] = useState(false);

  // Query state
  const [domainName, setDomainName] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [queryResult, setQueryResult] =
    useState<DomainCheckerQueryResult | null>(null);
  const [cachedQueries, setCachedQueries] = useState<
    DomainCheckerQueryResult[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [currentChainId, setCurrentChainId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch current chain ID
  const fetchCurrentChainId = useCallback(async () => {
    if (!domainCheckerAppId) return;

    try {
      const result = await lineraAdapter.queryApplication<{
        data?: { currentChainId: string };
        errors?: Array<{ message: string }>;
      }>({
        query: `query { currentChainId }`,
      });

      if (result.data?.currentChainId) {
        setCurrentChainId(result.data.currentChainId);
      }
    } catch (err) {
      console.error("Failed to fetch current chain ID:", err);
    }
  }, [domainCheckerAppId]);

  // Fetch all cached query results
  const fetchCachedQueries = useCallback(async () => {
    if (!domainCheckerAppId) return;

    try {
      const result = await lineraAdapter.queryApplication<{
        data?: { allCachedQueries: DomainCheckerQueryResult[] };
        errors?: Array<{ message: string }>;
      }>({
        query: `query { allCachedQueries { name owner isAvailable expiration queryTimestamp } }`,
      });

      if (result.data?.allCachedQueries) {
        setCachedQueries(result.data.allCachedQueries);
      }
    } catch (err) {
      console.error("Failed to fetch cached queries:", err);
    }
  }, [domainCheckerAppId]);

  // Check if a query is pending
  const checkPendingQuery = useCallback(
    async (name: string): Promise<boolean> => {
      if (!domainCheckerAppId) return false;

      try {
        const result = await lineraAdapter.queryApplication<{
          data?: { isQueryPending: boolean };
          errors?: Array<{ message: string }>;
        }>({
          query: `query { isQueryPending(name: "${name}") }`,
        });

        return result.data?.isQueryPending ?? false;
      } catch (err) {
        console.error("Failed to check pending query:", err);
        return false;
      }
    },
    [domainCheckerAppId],
  );

  // Fetch query result for a specific domain
  const fetchQueryResult = useCallback(
    async (name: string): Promise<DomainCheckerQueryResult | null> => {
      if (!domainCheckerAppId) return null;

      try {
        const result = await lineraAdapter.queryApplication<{
          data?: { domainQuery: DomainCheckerQueryResult | null };
          errors?: Array<{ message: string }>;
        }>({
          query: `query { domainQuery(name: "${name}") { name owner isAvailable expiration queryTimestamp } }`,
        });

        return result.data?.domainQuery ?? null;
      } catch (err) {
        console.error("Failed to fetch query result:", err);
        return null;
      }
    },
    [domainCheckerAppId],
  );

  // Initialize
  useEffect(() => {
    if (mounted && isLoggedIn && primaryWallet && domainCheckerAppId) {
      fetchCurrentChainId();
      fetchCachedQueries();
    }
  }, [
    mounted,
    isLoggedIn,
    primaryWallet,
    domainCheckerAppId,
    fetchCurrentChainId,
    fetchCachedQueries,
  ]);

  // Handle cross-chain domain query
  async function handleCheckOwnership() {
    if (!domainName.trim()) {
      setError("Please enter a domain name");
      return;
    }
    if (!registryChainId) {
      setError("Registry chain ID not available");
      return;
    }
    if (!domainCheckerAppId) {
      setError("Domain checker application ID not set");
      return;
    }

    setIsQuerying(true);
    setIsPending(false);
    setError(null);
    setQueryResult(null);

    try {
      // Step 1: Send CheckOwnership operation to domain_checker contract
      // This will trigger a cross-chain message to the LNS registry
      const result = await lineraAdapter.queryApplication<{
        data?: { checkOwnership: boolean };
        errors?: Array<{ message: string }>;
      }>({
        query: `mutation { checkOwnership(name: "${domainName.trim()}", registryChainId: "${registryChainId}") }`,
      });

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.checkOwnership) {
        setIsPending(true);

        // Step 2: Poll for the response
        // The cross-chain message needs time to propagate
        let attempts = 0;
        const maxAttempts = 15;
        const pollInterval = 2000; // 2 seconds

        const pollForResult =
          async (): Promise<DomainCheckerQueryResult | null> => {
            attempts++;
            console.log(
              `Polling for cross-chain response (attempt ${attempts}/${maxAttempts})...`,
            );

            // First check if still pending
            const stillPending = await checkPendingQuery(domainName.trim());

            if (!stillPending) {
              // Query completed, fetch the result
              const queryRes = await fetchQueryResult(domainName.trim());
              if (queryRes) {
                return queryRes;
              }
            }

            if (attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, pollInterval));
              return pollForResult();
            }

            return null;
          };

        // Start polling after initial delay
        setTimeout(async () => {
          const finalResult = await pollForResult();
          setIsPending(false);

          if (finalResult) {
            setQueryResult(finalResult);
            fetchCachedQueries(); // Refresh cached queries list
          } else {
            setError(
              "Cross-chain query timed out. The response may still arrive - check cached queries.",
            );
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Failed to check ownership:", err);
      setError(
        err instanceof Error ? err.message : "Failed to check ownership",
      );
      setIsPending(false);
    } finally {
      setIsQuerying(false);
    }
  }

  function formatTimestamp(micros: number): string {
    const date = new Date(micros / 1000); // Convert microseconds to milliseconds
    return date.toLocaleString();
  }

  if (!mounted) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-white">
        Cross-Chain Domain Query Test
      </h2>

      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        This component tests the Request-Response pattern for cross-chain state
        queries. It uses the{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          domain_checker
        </code>{" "}
        contract to query domain ownership from the LNS registry on another
        chain.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Chain Info */}
      <div className="mb-4 space-y-1 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">Current Chain:</span>{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
            {currentChainId
              ? `${currentChainId.slice(0, 12)}...`
              : "Not connected"}
          </code>
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">Registry Chain:</span>{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
            {registryChainId ? `${registryChainId.slice(0, 12)}...` : "Not set"}
          </code>
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">Domain Checker App:</span>{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
            {domainCheckerAppId
              ? `${domainCheckerAppId.slice(0, 12)}...`
              : "Not set"}
          </code>
        </p>
      </div>

      {/* Query Form */}
      <div className="mb-6">
        <label
          htmlFor="domain-checker-input"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Domain Name to Query
        </label>
        <div className="flex gap-2">
          <input
            id="domain-checker-input"
            type="text"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder="example"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            disabled={isQuerying || isPending}
          />
          <span className="flex items-center text-zinc-500 dark:text-zinc-400">
            .linera
          </span>
          <button
            type="button"
            onClick={handleCheckOwnership}
            disabled={
              isQuerying || isPending || !domainName.trim() || !registryChainId
            }
            className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isQuerying
              ? "Sending..."
              : isPending
                ? "Waiting..."
                : "Query via Contract"}
          </button>
        </div>
        {isPending && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            Waiting for cross-chain response... This may take 10-30 seconds.
          </p>
        )}
      </div>

      {/* Query Result */}
      {queryResult && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <h3 className="mb-2 font-semibold text-green-800 dark:text-green-300">
            Query Result (from contract state)
          </h3>
          <div className="space-y-1 text-sm">
            <p className="text-green-700 dark:text-green-400">
              <span className="font-medium">Domain:</span> {queryResult.name}
              .linera
            </p>
            <p className="text-green-700 dark:text-green-400">
              <span className="font-medium">Available:</span>{" "}
              {queryResult.isAvailable ? "Yes" : "No"}
            </p>
            <p className="text-green-700 dark:text-green-400">
              <span className="font-medium">Owner:</span>{" "}
              {queryResult.owner || "None (not registered)"}
            </p>
            {queryResult.expiration && (
              <p className="text-green-700 dark:text-green-400">
                <span className="font-medium">Expiration:</span>{" "}
                {formatTimestamp(queryResult.expiration)}
              </p>
            )}
            <p className="text-green-700 dark:text-green-400">
              <span className="font-medium">Query Time:</span>{" "}
              {formatTimestamp(queryResult.queryTimestamp)}
            </p>
          </div>
        </div>
      )}

      {/* Cached Queries */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
            Cached Query Results
          </h3>
          <button
            type="button"
            onClick={fetchCachedQueries}
            className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
          >
            Refresh
          </button>
        </div>

        {cachedQueries.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No cached queries yet. Query a domain to see results stored in the
            contract.
          </p>
        ) : (
          <div className="space-y-2">
            {cachedQueries.map((query) => (
              <div
                key={query.name}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {query.name}.linera
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      query.isAvailable
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {query.isAvailable ? "Available" : "Taken"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Owner: {query.owner || "None"} | Queried:{" "}
                  {formatTimestamp(query.queryTimestamp)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="mb-2 font-semibold text-zinc-800 dark:text-zinc-200">
          How Cross-Chain Query Works
        </h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            User calls{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">
              checkOwnership
            </code>{" "}
            on domain_checker contract
          </li>
          <li>
            Contract sends{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">
              RequestCheckOwnership
            </code>{" "}
            message to LNS registry chain
          </li>
          <li>
            LNS registry processes the request and sends{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">
              OwnershipResponse
            </code>{" "}
            back
          </li>
          <li>domain_checker receives the response and stores it in state</li>
          <li>UI polls the contract state to retrieve the result</li>
        </ol>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Note: Cross-chain messages are asynchronous and may take several
          seconds to propagate.
        </p>
      </div>
    </div>
  );
}
