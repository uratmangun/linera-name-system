"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  domain?: ExtendedDomainInfo;
}

interface DomainInfo {
  name: string;
  owner: string;
}

interface ExtendedDomainInfo {
  name: string;
  owner: string;
  ownerChainId: string;
  expiration: number;
  isExpired: boolean;
  price: string;
  isForSale: boolean;
  value: string;
}

export default function CounterApp() {
  const { primaryWallet } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  const [mounted, setMounted] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [registryChainId, setRegistryChainId] = useState<string | null>(null);
  const [logs, setLogs] = useState<BlockLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const providerRef = useRef<LineraProvider | null>(null);
  const [chainConnected, setChainConnected] = useState(false);
  const [appConnected, setAppConnected] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);

  // Domain registration state
  const [domainName, setDomainName] = useState("");
  const [searchResult, setSearchResult] = useState<DomainQueryResult | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [allDomains, setAllDomains] = useState<ExtendedDomainInfo[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Domain management state
  const [extendYears, setExtendYears] = useState(1);
  const [isExtending, setIsExtending] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [isSettingPrice, setIsSettingPrice] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isSettingValue, setIsSettingValue] = useState(false);
  const [selectedDomain, setSelectedDomain] =
    useState<ExtendedDomainInfo | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [transferAddress, setTransferAddress] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Withdraw state
  const [claimableBalance, setClaimableBalance] = useState<string | null>(null);
  const [isLoadingClaimable, setIsLoadingClaimable] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const applicationId = process.env.NEXT_PUBLIC_LINERA_APPLICATION_ID || "";

  // Registration/Extension fee in LINERA (0.1 per year)
  const REGISTRATION_FEE_LINERA = 0.1;

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
      setError(
        err instanceof Error ? err.message : "Failed to auto-connect to Linera",
      );
    } finally {
      setIsAutoConnecting(false);
    }
  }, [
    primaryWallet,
    applicationId,
    chainConnected,
    appConnected,
    isAutoConnecting,
  ]);

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
      setRegistryChainId(null);
      setLogs([]);
      setError(null);
      setSearchResult(null);
      setAllDomains([]);
      setBalance(null);
      setClaimableBalance(null);
    }
  }, [isLoggedIn, primaryWallet]);

  useEffect(() => {
    if (!chainConnected || !providerRef.current) return;
    const client = providerRef.current.client;
    if (!client || typeof client.onNotification !== "function") return;

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
      console.error("Failed to set notification handler:", err);
    }
    return () => {};
  }, [chainConnected]);

  // Fetch chain balance
  const fetchBalance = useCallback(async () => {
    if (!chainConnected) return;
    setIsLoadingBalance(true);

    try {
      const bal = await lineraAdapter.getBalance();
      setBalance(bal);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [chainConnected]);

  // Fetch registry chain ID
  const fetchRegistryInfo = useCallback(async () => {
    if (!appConnected) return;

    try {
      const registryResult = await lineraAdapter.queryApplication<{
        data?: { registryChainId: string | null };
        errors?: Array<{ message: string }>;
      }>({
        query: `query { registryChainId }`,
      });
      if (registryResult.data?.registryChainId) {
        setRegistryChainId(registryResult.data.registryChainId);
      }
    } catch (err) {
      console.error("Failed to fetch registry chain ID:", err);
    }
  }, [appConnected]);

  // Fetch all registered domains from registry chain
  const fetchAllDomains = useCallback(async () => {
    if (!appConnected || !registryChainId) return;
    setIsLoadingDomains(true);

    try {
      // Query the registry chain directly for authoritative data
      const result = await lineraAdapter.queryApplicationOnChain<{
        data?: { allDomains: ExtendedDomainInfo[] };
        errors?: Array<{ message: string }>;
      }>(
        registryChainId,
        applicationId,
        `query { allDomains { name owner ownerChainId expiration isExpired price isForSale value } }`,
      );
      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }
      setAllDomains(result.data?.allDomains || []);
    } catch (err) {
      console.error("Failed to fetch all domains:", err);
    } finally {
      setIsLoadingDomains(false);
    }
  }, [appConnected, registryChainId, applicationId]);

  // Fetch claimable balance for domain sales
  const fetchClaimableBalance = useCallback(async () => {
    if (!appConnected || !registryChainId || !primaryWallet?.address) return;
    setIsLoadingClaimable(true);

    try {
      const result = await lineraAdapter.queryApplicationOnChain<{
        data?: { claimableBalance: string };
        errors?: Array<{ message: string }>;
      }>(
        registryChainId,
        applicationId,
        `query { claimableBalance(owner: "${primaryWallet.address}") }`,
      );
      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }
      setClaimableBalance(result.data?.claimableBalance || "0");
    } catch (err) {
      console.error("Failed to fetch claimable balance:", err);
      setClaimableBalance("0");
    } finally {
      setIsLoadingClaimable(false);
    }
  }, [appConnected, registryChainId, applicationId, primaryWallet?.address]);

  // Fetch balance when chain is connected
  useEffect(() => {
    if (chainConnected) {
      fetchBalance();
    }
  }, [chainConnected, fetchBalance]);

  // Fetch registry info when app is connected
  useEffect(() => {
    if (appConnected) {
      fetchRegistryInfo();
    }
  }, [appConnected, fetchRegistryInfo]);

  // Fetch all domains when registry chain ID is available
  useEffect(() => {
    if (appConnected && registryChainId) {
      fetchAllDomains();
    }
  }, [appConnected, registryChainId, fetchAllDomains]);

  // Fetch claimable balance when app is connected and wallet is available
  useEffect(() => {
    if (appConnected && registryChainId && primaryWallet?.address) {
      fetchClaimableBalance();
    }
  }, [
    appConnected,
    registryChainId,
    primaryWallet?.address,
    fetchClaimableBalance,
  ]);

  // Update selectedDomain when allDomains changes (to reflect updates after operations)
  const selectedDomainName = selectedDomain?.name;
  useEffect(() => {
    if (selectedDomainName && allDomains.length > 0) {
      const updatedDomain = allDomains.find(
        (d) => d.name === selectedDomainName,
      );
      if (updatedDomain) {
        setSelectedDomain(updatedDomain);
      }
    }
  }, [allDomains, selectedDomainName]);

  async function handleWithdraw() {
    if (!claimableBalance || claimableBalance === "0") {
      setError("No balance to withdraw");
      return;
    }
    setIsWithdrawing(true);
    setError(null);

    try {
      const result = await lineraAdapter.queryApplication<{
        data?: { withdraw: boolean };
        errors?: Array<{ message: string }>;
      }>({
        query: `mutation { withdraw }`,
      });

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.withdraw) {
        alert(
          `Withdrawal of ${formatPrice(claimableBalance)} LINERA submitted!`,
        );
        setTimeout(() => {
          fetchClaimableBalance();
          fetchBalance();
        }, 3000);
      }
    } catch (err) {
      console.error("Failed to withdraw:", err);
      setError(err instanceof Error ? err.message : "Failed to withdraw");
    } finally {
      setIsWithdrawing(false);
    }
  }

  async function handleCheckDomain() {
    if (!domainName.trim()) {
      setError("Please enter a domain name");
      return;
    }
    if (!registryChainId) {
      setError("Registry chain ID not available yet");
      return;
    }
    setIsSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      // Query the registry chain directly for authoritative data
      const result = await lineraAdapter.queryApplicationOnChain<{
        data?: { domain?: ExtendedDomainInfo; isAvailable: boolean };
        errors?: Array<{ message: string }>;
      }>(
        registryChainId,
        applicationId,
        `query { domain(name: "${domainName.trim()}") { name owner ownerChainId expiration isExpired price isForSale value } isAvailable(name: "${domainName.trim()}") }`,
      );
      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }
      setSearchResult({
        IsAvailable: result.data?.isAvailable,
        domain: result.data?.domain,
      });
    } catch (err) {
      console.error("Failed to check domain:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to check domain availability",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleRegisterDomain() {
    if (!domainName.trim()) {
      setError("Please enter a domain name");
      return;
    }
    if (!registryChainId) {
      setError("Registry chain ID not available yet");
      return;
    }

    // Confirm with the user including the fee
    if (
      !confirm(
        `Register ${domainName.trim()}.linera for ${REGISTRATION_FEE_LINERA} LINERA?`,
      )
    ) {
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      const result = await lineraAdapter.queryApplication<{
        data?: { register: boolean };
        errors?: Array<{ message: string }>;
      }>({
        query: `mutation { register(name: "${domainName.trim()}") }`,
      });

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.register) {
        setSearchResult({ IsAvailable: false });
        setError(null);
        alert(
          `Domain ${domainName.trim()}.linera registration submitted! Waiting for cross-chain sync...`,
        );

        // Poll for the registration to appear on the registry chain
        // Cross-chain messages may take several seconds to propagate
        let attempts = 0;
        const maxAttempts = 10;
        const pollInterval = 3000; // 3 seconds between polls

        const pollRegistration = async (): Promise<boolean> => {
          attempts++;
          console.log(
            `Polling for registration (attempt ${attempts}/${maxAttempts})...`,
          );

          try {
            const checkResult = await lineraAdapter.queryApplicationOnChain<{
              data?: { isAvailable: boolean };
              errors?: Array<{ message: string }>;
            }>(
              registryChainId,
              applicationId,
              `query { isAvailable(name: "${domainName.trim()}") }`,
            );

            // If domain is no longer available, registration succeeded
            if (checkResult.data?.isAvailable === false) {
              console.log("Registration confirmed on registry chain!");
              return true;
            }
          } catch (err) {
            console.log("Poll attempt failed:", err);
          }

          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            return pollRegistration();
          }

          return false;
        };

        // Start polling after a short initial delay
        setTimeout(async () => {
          const confirmed = await pollRegistration();
          if (confirmed) {
            fetchAllDomains();
          } else {
            console.log(
              "Registration not yet confirmed. Please refresh manually.",
            );
            fetchAllDomains(); // Try to fetch anyway
          }
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to register domain:", err);
      setError(
        err instanceof Error ? err.message : "Failed to register domain",
      );
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleLookupOwner() {
    if (!domainName.trim()) {
      setError("Please enter a domain name");
      return;
    }
    if (!registryChainId) {
      setError("Registry chain ID not available yet");
      return;
    }
    setIsSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      // Query the registry chain directly for authoritative data
      const result = await lineraAdapter.queryApplicationOnChain<{
        data?: { domain?: ExtendedDomainInfo; owner: string | null };
        errors?: Array<{ message: string }>;
      }>(
        registryChainId,
        applicationId,
        `query { domain(name: "${domainName.trim()}") { name owner ownerChainId expiration isExpired price isForSale value } owner(name: "${domainName.trim()}") }`,
      );
      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }
      setSearchResult({
        Owner: result.data?.owner,
        domain: result.data?.domain,
      });
    } catch (err) {
      console.error("Failed to lookup owner:", err);
      setError(
        err instanceof Error ? err.message : "Failed to lookup domain owner",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleExtendDomain(name: string) {
    // Calculate total cost
    const totalCost = (extendYears * REGISTRATION_FEE_LINERA).toFixed(1);

    // Confirm with the user including the fee
    if (
      !confirm(
        `Extend ${name}.linera by ${extendYears} year(s) for ${totalCost} LINERA?`,
      )
    ) {
      return;
    }

    setIsExtending(true);
    setError(null);
    try {
      const result = await lineraAdapter.queryApplication<{
        data?: { extend: boolean };
        errors?: Array<{ message: string }>;
      }>({
        query: `mutation { extend(name: "${name}", years: ${extendYears}) }`,
      });

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.extend) {
        alert(`Domain ${name}.linera extended by ${extendYears} year(s)!`);
        setTimeout(() => fetchAllDomains(), 2000);
      }
    } catch (err) {
      console.error("Failed to extend domain:", err);
      setError(err instanceof Error ? err.message : "Failed to extend domain");
    } finally {
      setIsExtending(false);
      setShowDomainModal(false);
    }
  }

  async function handleSetPrice(name: string) {
    setIsSettingPrice(true);
    setError(null);
    try {
      // Convert decimal price to smallest unit (18 decimals like most blockchains)
      // e.g., 0.01 LINERA = 10000000000000000 (0.01 * 10^18)
      const priceFloat = parseFloat(newPrice) || 0;
      const priceInSmallestUnit = BigInt(
        Math.floor(priceFloat * 1e18),
      ).toString();

      const result = await lineraAdapter.queryApplication<{
        data?: { setPrice: boolean };
        errors?: Array<{ message: string }>;
      }>({
        query: `mutation { setPrice(name: "${name}", price: "${priceInSmallestUnit}") }`,
      });

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.setPrice) {
        alert(`Domain ${name}.linera price set to ${newPrice}!`);
        setTimeout(() => fetchAllDomains(), 2000);
      }
    } catch (err) {
      console.error("Failed to set price:", err);
      setError(err instanceof Error ? err.message : "Failed to set price");
    } finally {
      setIsSettingPrice(false);
      setShowDomainModal(false);
    }
  }

  async function handleBuyDomain(name: string, expectedPrice: string) {
    if (!confirm(`Are you sure you want to buy ${name}.linera?`)) {
      return;
    }
    setIsBuying(true);
    setError(null);
    try {
      const result = await lineraAdapter.queryApplication<{
        data?: { buy: boolean };
        errors?: Array<{ message: string }>;
      }>({
        query: `mutation { buy(name: "${name}", expectedPrice: "${expectedPrice}") }`,
      });

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.buy) {
        alert(`Domain ${name}.linera purchased successfully!`);
        setTimeout(() => fetchAllDomains(), 2000);
      }
    } catch (err) {
      console.error("Failed to buy domain:", err);
      setError(err instanceof Error ? err.message : "Failed to buy domain");
    } finally {
      setIsBuying(false);
      setShowDomainModal(false);
    }
  }

  async function handleSetValue(name: string) {
    setIsSettingValue(true);
    setError(null);
    try {
      const result = await lineraAdapter.queryApplication<{
        data?: { setValue: boolean };
        errors?: Array<{ message: string }>;
      }>({
        query: `mutation { setValue(name: "${name}", value: "${newValue}") }`,
      });

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.setValue) {
        alert(`Domain ${name}.linera value set successfully!`);
        setTimeout(() => fetchAllDomains(), 2000);
      }
    } catch (err) {
      console.error("Failed to set value:", err);
      setError(err instanceof Error ? err.message : "Failed to set value");
    } finally {
      setIsSettingValue(false);
      setShowDomainModal(false);
    }
  }

  async function handleTransferDomain(name: string) {
    if (!transferAddress.trim()) {
      setError("Please enter a recipient address");
      return;
    }
    if (
      !confirm(
        `Are you sure you want to transfer ${name}.linera to ${transferAddress}? This action cannot be undone.`,
      )
    ) {
      return;
    }
    setIsTransferring(true);
    setError(null);
    try {
      const result = await lineraAdapter.queryApplication<{
        data?: { transfer: boolean };
        errors?: Array<{ message: string }>;
      }>({
        query: `mutation { transfer(name: "${name}", newOwner: "${transferAddress.trim()}") }`,
      });

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      if (result.data?.transfer) {
        alert(
          `Domain ${name}.linera transferred to ${transferAddress} successfully!`,
        );
        setTransferAddress("");
        setTimeout(() => fetchAllDomains(), 2000);
      }
    } catch (err) {
      console.error("Failed to transfer domain:", err);
      setError(
        err instanceof Error ? err.message : "Failed to transfer domain",
      );
    } finally {
      setIsTransferring(false);
      setShowDomainModal(false);
    }
  }

  function formatExpiration(timestamp: number): string {
    const date = new Date(timestamp / 1000);
    return date.toLocaleDateString();
  }

  // Convert price from smallest unit (u128) to human-readable format
  function formatPrice(priceStr: string): string {
    try {
      const price = BigInt(priceStr);
      if (price === BigInt(0)) return "0";
      // Convert from smallest unit (18 decimals) to human-readable
      const divisor = BigInt("1000000000000000000"); // 10^18
      const wholePart = price / divisor;
      const fractionalPart = price % divisor;
      if (fractionalPart === BigInt(0)) {
        return wholePart.toString();
      }
      // Format fractional part with up to 6 decimal places
      const fractionalStr = fractionalPart.toString().padStart(18, "0");
      const trimmed = fractionalStr.slice(0, 6).replace(/0+$/, "");
      if (trimmed === "") {
        return wholePart.toString();
      }
      return `${wholePart}.${trimmed}`;
    } catch {
      return priceStr;
    }
  }

  function openDomainModal(domain: ExtendedDomainInfo) {
    setSelectedDomain(domain);
    // Convert stored price to human-readable for the input field
    setNewPrice(domain.isForSale ? formatPrice(domain.price) : "");
    setNewValue(domain.value);
    setShowDomainModal(true);
  }

  // Filter domains to only show those owned by the logged-in account
  const myDomains = useMemo(() => {
    if (!primaryWallet?.address) return [];
    return allDomains.filter(
      (d) => d.owner.toLowerCase() === primaryWallet.address.toLowerCase(),
    );
  }, [allDomains, primaryWallet?.address]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full max-w-3xl px-6 py-12">
        <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-900">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Linera Name System
            </h1>
            <DynamicWidget />
          </div>

          <div className="mb-8">
            <p className="mb-2 text-zinc-600 dark:text-zinc-400">
              Register your unique .linera domain on the Linera blockchain.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              Connect your wallet to get started. Your chain will be
              automatically claimed from the testnet faucet.
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
              <p className="text-sky-600 dark:text-sky-400">
                Connecting to Linera testnet...
              </p>
            </div>
          )}

          {mounted && !isLoggedIn && (
            <div className="mb-6 rounded-lg bg-zinc-100 p-6 text-center dark:bg-zinc-800">
              <p className="text-zinc-500 dark:text-zinc-400">
                Please connect your wallet using the button above to get
                started.
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
                      onChange={(e) =>
                        setDomainName(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        )
                      }
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
                    {searchResult.IsAvailable !== undefined &&
                      searchResult.IsAvailable && (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">
                              {domainName}.linera
                            </p>
                            <p className="text-green-600 dark:text-green-400">
                              Available!
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              Registration fee: {REGISTRATION_FEE_LINERA} LINERA
                              (1 year)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleRegisterDomain}
                            disabled={isRegistering}
                            className="rounded-lg bg-sky-600 px-6 py-2 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isRegistering
                              ? "Registering..."
                              : `Register (${REGISTRATION_FEE_LINERA} LINERA)`}
                          </button>
                        </div>
                      )}
                    {searchResult.domain && (
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {searchResult.domain.name}.linera
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Owner:
                        </p>
                        <p className="break-all font-mono text-sm text-zinc-700 dark:text-zinc-300 mb-2">
                          {searchResult.domain.owner}
                        </p>
                        <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                          <p>
                            Expires:{" "}
                            {formatExpiration(searchResult.domain.expiration)}
                          </p>
                          <p
                            className={
                              searchResult.domain.isExpired
                                ? "text-red-500 dark:text-red-400"
                                : ""
                            }
                          >
                            Status:{" "}
                            {searchResult.domain.isExpired
                              ? "Expired"
                              : "Active"}
                          </p>
                          <p>
                            {searchResult.domain.isForSale
                              ? `Price: ${formatPrice(searchResult.domain.price)} LINERA`
                              : "Not for sale"}
                          </p>
                          <p>
                            Value: {searchResult.domain.value || "(not set)"}
                          </p>
                        </div>
                        {/* Buy button - show if domain is for sale and not owned by current user */}
                        {searchResult.domain.isForSale &&
                          !searchResult.domain.isExpired &&
                          primaryWallet?.address &&
                          searchResult.domain.owner.toLowerCase() !==
                            primaryWallet.address.toLowerCase() && (
                            <div className="mt-4">
                              <button
                                type="button"
                                onClick={() =>
                                  handleBuyDomain(
                                    searchResult.domain!.name,
                                    searchResult.domain!.price,
                                  )
                                }
                                disabled={isBuying}
                                className="w-full rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isBuying
                                  ? "Buying..."
                                  : `Buy for ${formatPrice(searchResult.domain.price)} LINERA`}
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* My Domains - Only show domains owned by logged-in account */}
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-800">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    My Domains
                  </h2>
                  <button
                    type="button"
                    onClick={fetchAllDomains}
                    disabled={isLoadingDomains}
                    className="rounded-lg bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  >
                    {isLoadingDomains ? "Loading..." : "Refresh"}
                  </button>
                </div>
                {myDomains.length === 0 ? (
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {isLoadingDomains
                      ? "Loading domains..."
                      : "You don't own any domains yet."}
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {myDomains.map((domain) => (
                      <li
                        key={domain.name}
                        onClick={() => openDomainModal(domain)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && openDomainModal(domain)
                        }
                        className="cursor-pointer rounded-lg bg-white p-3 dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">
                              {domain.name}.linera
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p
                              className={
                                domain.isExpired
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-green-500 dark:text-green-400"
                              }
                            >
                              {domain.isExpired ? "Expired" : "Active"}
                            </p>
                            {domain.isForSale && (
                              <p className="text-sky-600 dark:text-sky-400">
                                {formatPrice(domain.price)} LINERA
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Claimable Balance & Withdraw Section */}
              <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-800">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    Domain Sales Balance
                  </h2>
                  <button
                    type="button"
                    onClick={fetchClaimableBalance}
                    disabled={isLoadingClaimable}
                    className="rounded-lg bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  >
                    {isLoadingClaimable ? "Loading..." : "Refresh"}
                  </button>
                </div>
                <div className="rounded-lg bg-white p-4 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Claimable Balance from Domain Sales
                      </p>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {isLoadingClaimable
                          ? "Loading..."
                          : claimableBalance
                            ? `${formatPrice(claimableBalance)} LINERA`
                            : "0 LINERA"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleWithdraw}
                      disabled={
                        isWithdrawing ||
                        !claimableBalance ||
                        claimableBalance === "0"
                      }
                      className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isWithdrawing ? "Withdrawing..." : "Withdraw"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    When someone buys your domain, the payment is held here.
                    Click withdraw to transfer it to your chain.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Domain Management Modal */}
          {showDomainModal && selectedDomain && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {selectedDomain.name}.linera
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowDomainModal(false)}
                    className="rounded-lg bg-zinc-100 p-2 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    aria-label="Close modal"
                  >
                    <svg
                      className="h-6 w-6 text-zinc-600 dark:text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <title>Close</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-6 grid gap-4 text-sm text-zinc-700 dark:text-zinc-300 md:grid-cols-2">
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Owner
                    </p>
                    <p className="break-all font-mono text-xs">
                      {selectedDomain.owner}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Expiration
                    </p>
                    <p className="font-mono text-xs">
                      {formatExpiration(selectedDomain.expiration)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Status
                    </p>
                    <p
                      className={
                        selectedDomain.isExpired
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }
                    >
                      {selectedDomain.isExpired ? "Expired" : "Active"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Price
                    </p>
                    <p>
                      {selectedDomain.isForSale
                        ? `${formatPrice(selectedDomain.price)} LINERA`
                        : "Not for sale"}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Value
                    </p>
                    <p className="break-all font-mono text-xs">
                      {selectedDomain.value || "(not set)"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Extend Domain */}
                  <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                    <h3 className="mb-2 font-semibold text-zinc-900 dark:text-white">
                      Extend Registration
                    </h3>
                    <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {REGISTRATION_FEE_LINERA} LINERA per year
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={extendYears}
                        onChange={(e) =>
                          setExtendYears(parseInt(e.target.value) || 1)
                        }
                        className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                      />
                      <span className="self-center text-zinc-600 dark:text-zinc-400">
                        year(s) ={" "}
                        {(extendYears * REGISTRATION_FEE_LINERA).toFixed(1)}{" "}
                        LINERA
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExtendDomain(selectedDomain.name)}
                        disabled={isExtending}
                        className="ml-auto rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isExtending ? "Extending..." : "Extend"}
                      </button>
                    </div>
                  </div>

                  {/* Set Price */}
                  <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                    <h3 className="mb-2 font-semibold text-zinc-900 dark:text-white">
                      Set Price
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        placeholder="Enter price (0 to remove from sale)"
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSetPrice(selectedDomain.name)}
                        disabled={isSettingPrice}
                        className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSettingPrice ? "Setting..." : "Set Price"}
                      </button>
                    </div>
                  </div>

                  {/* Set Value */}
                  <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                    <h3 className="mb-2 font-semibold text-zinc-900 dark:text-white">
                      Set DNS Value
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="Enter DNS value (e.g., IP address or URL)"
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSetValue(selectedDomain.name)}
                        disabled={isSettingValue}
                        className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSettingValue ? "Setting..." : "Set Value"}
                      </button>
                    </div>
                  </div>

                  {/* Transfer Domain */}
                  <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                    <h3 className="mb-2 font-semibold text-zinc-900 dark:text-white">
                      Transfer Domain
                    </h3>
                    <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Transfer ownership of this domain to another address. This
                      action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={transferAddress}
                        onChange={(e) => setTransferAddress(e.target.value)}
                        placeholder="Enter recipient address (0x...)"
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleTransferDomain(selectedDomain.name)
                        }
                        disabled={isTransferring || !transferAddress.trim()}
                        className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isTransferring ? "Transferring..." : "Transfer"}
                      </button>
                    </div>
                  </div>

                  {/* Buy Domain - only show if not the owner */}
                  {selectedDomain.isForSale &&
                    !selectedDomain.isExpired &&
                    primaryWallet?.address &&
                    selectedDomain.owner.toLowerCase() !==
                      primaryWallet.address.toLowerCase() && (
                      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                        <h3 className="mb-2 font-semibold text-zinc-900 dark:text-white">
                          Buy Domain
                        </h3>
                        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                          Price: {formatPrice(selectedDomain.price)} LINERA
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleBuyDomain(
                              selectedDomain.name,
                              selectedDomain.price,
                            )
                          }
                          disabled={isBuying}
                          className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBuying ? "Buying..." : "Buy Domain"}
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* Chain Info */}
          {chainConnected && (
            <div className="mt-8 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Connected to Linera Testnet
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">Your Chain ID:</span>{" "}
                  <code className="break-all rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {chainId
                      ? `${chainId.slice(0, 16)}...${chainId.slice(-8)}`
                      : "..."}
                  </code>
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">Balance:</span>{" "}
                  <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {isLoadingBalance
                      ? "Loading..."
                      : balance !== null
                        ? `${balance} LINERA`
                        : "..."}
                  </code>
                  <button
                    type="button"
                    onClick={fetchBalance}
                    disabled={isLoadingBalance}
                    className="ml-2 rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  >
                    Refresh
                  </button>
                </p>
                {registryChainId && (
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">Registry Chain ID:</span>{" "}
                    <code className="break-all rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {registryChainId.slice(0, 16)}...
                      {registryChainId.slice(-8)}
                    </code>
                  </p>
                )}
                <p className="text-zinc-500 dark:text-zinc-500">
                  Application ID:{" "}
                  <code className="break-all font-mono text-xs">
                    {applicationId.slice(0, 16)}...{applicationId.slice(-8)}
                  </code>
                </p>
              </div>

              {logs.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Recent Blocks
                  </h3>
                  <ul className="max-h-32 space-y-1 overflow-y-auto">
                    {logs.slice(0, 5).map((log, index) => (
                      <li
                        key={`${log.hash}-${index}`}
                        className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800"
                      >
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {log.height}
                        </span>
                        :{" "}
                        <span className="text-zinc-500 dark:text-zinc-500">
                          {log.hash.slice(0, 16)}...
                        </span>
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
