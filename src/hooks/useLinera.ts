"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { lineraAdapter, type LineraProvider } from "@/lib/linera-adapter";

export interface ExtendedDomainInfo {
  name: string;
  owner: string;
  ownerChainId: string;
  expiration: number;
  isExpired: boolean;
  price: string;
  isForSale: boolean;
  value: string;
}

export interface DomainQueryResult {
  Owner?: string | null;
  IsAvailable?: boolean;
  domain?: ExtendedDomainInfo;
}

interface BlockLog {
  height: number;
  hash: string;
}

const APPLICATION_ID = process.env.NEXT_PUBLIC_LINERA_APPLICATION_ID || "";
const REGISTRATION_FEE_LINERA = 0.1;

export function useLinera() {
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

  // Domain state
  const [allDomains, setAllDomains] = useState<ExtendedDomainInfo[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Claimable balance state
  const [claimableBalance, setClaimableBalance] = useState<string | null>(null);
  const [isLoadingClaimable, setIsLoadingClaimable] = useState(false);

  useEffect(() => {
    setMounted(true);
    setChainConnected(lineraAdapter.isChainConnected());
    setAppConnected(lineraAdapter.isApplicationSet());
  }, []);

  // Auto-connect to Linera when wallet is connected
  const autoConnect = useCallback(async () => {
    if (!primaryWallet || !APPLICATION_ID || isAutoConnecting) return;
    if (chainConnected && appConnected) return;

    setIsAutoConnecting(true);
    setError(null);

    try {
      if (!chainConnected) {
        const provider = await lineraAdapter.connect(primaryWallet);
        providerRef.current = provider;
        setChainConnected(true);
        setChainId(provider.chainId);
      }

      if (!appConnected && APPLICATION_ID) {
        await lineraAdapter.setApplication(APPLICATION_ID);
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
  }, [primaryWallet, chainConnected, appConnected, isAutoConnecting]);

  useEffect(() => {
    if (mounted && isLoggedIn && primaryWallet && !chainConnected) {
      autoConnect();
    }
  }, [mounted, isLoggedIn, primaryWallet, chainConnected, autoConnect]);

  // Reset when wallet disconnects
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
      setAllDomains([]);
      setBalance(null);
      setClaimableBalance(null);
    }
  }, [isLoggedIn, primaryWallet]);

  // Block notifications
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
  }, [chainConnected]);

  // Fetch balance
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

  // Fetch all domains
  const fetchAllDomains = useCallback(async () => {
    if (!appConnected || !registryChainId) return;
    setIsLoadingDomains(true);
    try {
      const result = await lineraAdapter.queryApplicationOnChain<{
        data?: { allDomains: ExtendedDomainInfo[] };
        errors?: Array<{ message: string }>;
      }>(
        registryChainId,
        APPLICATION_ID,
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
  }, [appConnected, registryChainId]);

  // Fetch claimable balance
  const fetchClaimableBalance = useCallback(async () => {
    if (!appConnected || !registryChainId || !primaryWallet?.address) return;
    setIsLoadingClaimable(true);
    try {
      const result = await lineraAdapter.queryApplicationOnChain<{
        data?: { claimableBalance: string };
        errors?: Array<{ message: string }>;
      }>(
        registryChainId,
        APPLICATION_ID,
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
  }, [appConnected, registryChainId, primaryWallet?.address]);

  // Auto-fetch on connection
  useEffect(() => {
    if (chainConnected) fetchBalance();
  }, [chainConnected, fetchBalance]);

  useEffect(() => {
    if (appConnected) fetchRegistryInfo();
  }, [appConnected, fetchRegistryInfo]);

  useEffect(() => {
    if (appConnected && registryChainId) fetchAllDomains();
  }, [appConnected, registryChainId, fetchAllDomains]);

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

  // Check domain availability
  const checkDomain = useCallback(
    async (domainName: string): Promise<DomainQueryResult | null> => {
      if (!domainName.trim() || !registryChainId) return null;
      try {
        const result = await lineraAdapter.queryApplicationOnChain<{
          data?: { domain?: ExtendedDomainInfo; isAvailable: boolean };
          errors?: Array<{ message: string }>;
        }>(
          registryChainId,
          APPLICATION_ID,
          `query { domain(name: "${domainName.trim()}") { name owner ownerChainId expiration isExpired price isForSale value } isAvailable(name: "${domainName.trim()}") }`,
        );
        if (result.errors?.length) {
          throw new Error(result.errors[0].message);
        }
        return {
          IsAvailable: result.data?.isAvailable,
          domain: result.data?.domain,
        };
      } catch (err) {
        console.error("Failed to check domain:", err);
        throw err;
      }
    },
    [registryChainId],
  );

  // Register domain
  const registerDomain = useCallback(
    async (domainName: string): Promise<boolean> => {
      if (!domainName.trim() || !registryChainId) return false;
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
        return result.data?.register ?? false;
      } catch (err) {
        console.error("Failed to register domain:", err);
        throw err;
      }
    },
    [registryChainId],
  );

  // Extend domain
  const extendDomain = useCallback(
    async (name: string, years: number): Promise<boolean> => {
      try {
        const result = await lineraAdapter.queryApplication<{
          data?: { extend: boolean };
          errors?: Array<{ message: string }>;
        }>({
          query: `mutation { extend(name: "${name}", years: ${years}) }`,
        });
        if (result.errors?.length) {
          throw new Error(result.errors[0].message);
        }
        return result.data?.extend ?? false;
      } catch (err) {
        console.error("Failed to extend domain:", err);
        throw err;
      }
    },
    [],
  );

  // Set price
  const setPrice = useCallback(
    async (name: string, price: string): Promise<boolean> => {
      try {
        const priceFloat = parseFloat(price) || 0;
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
        return result.data?.setPrice ?? false;
      } catch (err) {
        console.error("Failed to set price:", err);
        throw err;
      }
    },
    [],
  );

  // Buy domain
  const buyDomain = useCallback(
    async (name: string, expectedPrice: string): Promise<boolean> => {
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
        return result.data?.buy ?? false;
      } catch (err) {
        console.error("Failed to buy domain:", err);
        throw err;
      }
    },
    [],
  );

  // Set value
  const setValue = useCallback(
    async (name: string, value: string): Promise<boolean> => {
      try {
        const result = await lineraAdapter.queryApplication<{
          data?: { setValue: boolean };
          errors?: Array<{ message: string }>;
        }>({
          query: `mutation { setValue(name: "${name}", value: "${value}") }`,
        });
        if (result.errors?.length) {
          throw new Error(result.errors[0].message);
        }
        return result.data?.setValue ?? false;
      } catch (err) {
        console.error("Failed to set value:", err);
        throw err;
      }
    },
    [],
  );

  // Transfer domain
  const transferDomain = useCallback(
    async (name: string, newOwner: string): Promise<boolean> => {
      try {
        const result = await lineraAdapter.queryApplication<{
          data?: { transfer: boolean };
          errors?: Array<{ message: string }>;
        }>({
          query: `mutation { transfer(name: "${name}", newOwner: "${newOwner.trim()}") }`,
        });
        if (result.errors?.length) {
          throw new Error(result.errors[0].message);
        }
        return result.data?.transfer ?? false;
      } catch (err) {
        console.error("Failed to transfer domain:", err);
        throw err;
      }
    },
    [],
  );

  // Withdraw
  const withdraw = useCallback(async (): Promise<boolean> => {
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
      return result.data?.withdraw ?? false;
    } catch (err) {
      console.error("Failed to withdraw:", err);
      throw err;
    }
  }, []);

  // My domains
  const myDomains = useMemo(() => {
    if (!primaryWallet?.address) return [];
    return allDomains.filter(
      (d) => d.owner.toLowerCase() === primaryWallet.address.toLowerCase(),
    );
  }, [allDomains, primaryWallet?.address]);

  // Utility functions
  const formatExpiration = (timestamp: number): string => {
    const date = new Date(timestamp / 1000);
    return date.toLocaleDateString();
  };

  const formatPrice = (priceStr: string): string => {
    try {
      const price = BigInt(priceStr);
      if (price === BigInt(0)) return "0";
      const divisor = BigInt("1000000000000000000");
      const wholePart = price / divisor;
      const fractionalPart = price % divisor;
      if (fractionalPart === BigInt(0)) {
        return wholePart.toString();
      }
      const fractionalStr = fractionalPart.toString().padStart(18, "0");
      const trimmed = fractionalStr.slice(0, 6).replace(/0+$/, "");
      if (trimmed === "") {
        return wholePart.toString();
      }
      return `${wholePart}.${trimmed}`;
    } catch {
      return priceStr;
    }
  };

  return {
    // State
    mounted,
    isLoggedIn,
    primaryWallet,
    chainId,
    registryChainId,
    chainConnected,
    appConnected,
    isAutoConnecting,
    error,
    setError,
    logs,

    // Domain state
    allDomains,
    myDomains,
    isLoadingDomains,

    // Balance state
    balance,
    isLoadingBalance,
    claimableBalance,
    isLoadingClaimable,

    // Actions
    fetchBalance,
    fetchAllDomains,
    fetchClaimableBalance,
    checkDomain,
    registerDomain,
    extendDomain,
    setPrice,
    buyDomain,
    setValue,
    transferDomain,
    withdraw,

    // Utils
    formatExpiration,
    formatPrice,

    // Constants
    applicationId: APPLICATION_ID,
    registrationFee: REGISTRATION_FEE_LINERA,
  };
}
