"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Globe,
  Shield,
  Zap,
  Menu,
  X,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  Tag,
  Send,
  Edit3,
  Calendar,
  ShoppingCart,
} from "lucide-react";
import Image from "next/image";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import {
  useLinera,
  type ExtendedDomainInfo,
  type DomainQueryResult,
} from "@/hooks/useLinera";

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<DomainQueryResult | null>(
    null,
  );
  const [searchError, setSearchError] = useState<string | null>(null);

  // Domain management modal state
  const [selectedDomain, setSelectedDomain] =
    useState<ExtendedDomainInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<
    "manage" | "extend" | "transfer" | "sell"
  >("manage");

  // Action states
  const [isRegistering, setIsRegistering] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [isSettingPrice, setIsSettingPrice] = useState(false);
  const [isSettingValue, setIsSettingValue] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Form inputs
  const [newValue, setNewValue] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [extendYears, setExtendYears] = useState(1);

  const {
    mounted,
    isLoggedIn,
    primaryWallet,
    chainConnected,
    appConnected,
    isAutoConnecting,
    error,
    setError,
    myDomains,
    isLoadingDomains,
    balance,
    isLoadingBalance,
    claimableBalance,
    isLoadingClaimable,
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
    formatExpiration,
    formatPrice,
    registrationFee,
  } = useLinera();

  // Search for a domain
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    // Normalize domain name (remove .linera if present, then add it back)
    let normalizedName = searchQuery.trim().toLowerCase();
    if (normalizedName.endsWith(".linera")) {
      normalizedName = normalizedName.slice(0, -7);
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const result = await checkDomain(normalizedName);
      setSearchResult(result);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Failed to search domain",
      );
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, checkDomain]);

  // Handle example domain click
  const handleExampleClick = (domain: string) => {
    setSearchQuery(domain);
    setSearchResult(null);
    setSearchError(null);
  };

  // Register a domain
  const handleRegister = async () => {
    if (!searchResult?.IsAvailable || !searchQuery.trim()) return;

    let normalizedName = searchQuery.trim().toLowerCase();
    if (normalizedName.endsWith(".linera")) {
      normalizedName = normalizedName.slice(0, -7);
    }

    setIsRegistering(true);
    try {
      await registerDomain(normalizedName);
      // Refresh data
      await fetchAllDomains();
      await fetchBalance();
      // Re-search to update result
      const result = await checkDomain(normalizedName);
      setSearchResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register domain",
      );
    } finally {
      setIsRegistering(false);
    }
  };

  // Buy a domain
  const handleBuy = async () => {
    if (!searchResult?.domain || !searchResult.domain.isForSale) return;

    setIsBuying(true);
    try {
      await buyDomain(searchResult.domain.name, searchResult.domain.price);
      // Refresh data
      await fetchAllDomains();
      await fetchBalance();
      // Re-search to update result
      const result = await checkDomain(searchResult.domain.name);
      setSearchResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to buy domain");
    } finally {
      setIsBuying(false);
    }
  };

  // Open domain management modal
  const openDomainModal = (domain: ExtendedDomainInfo) => {
    setSelectedDomain(domain);
    setModalTab("manage");
    setNewValue(domain.value || "");
    setNewPrice(formatPrice(domain.price));
    setTransferTo("");
    setExtendYears(1);
    setIsModalOpen(true);
  };

  // Handle set value
  const handleSetValue = async () => {
    if (!selectedDomain) return;
    setIsSettingValue(true);
    try {
      await setValue(selectedDomain.name, newValue);
      await fetchAllDomains();
      setSelectedDomain({ ...selectedDomain, value: newValue });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set value");
    } finally {
      setIsSettingValue(false);
    }
  };

  // Handle set price
  const handleSetPrice = async () => {
    if (!selectedDomain) return;
    setIsSettingPrice(true);
    try {
      await setPrice(selectedDomain.name, newPrice);
      await fetchAllDomains();
      // Update modal with new price
      const priceFloat = parseFloat(newPrice) || 0;
      const priceInSmallestUnit = BigInt(
        Math.floor(priceFloat * 1e18),
      ).toString();
      setSelectedDomain({
        ...selectedDomain,
        price: priceInSmallestUnit,
        isForSale: priceFloat > 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set price");
    } finally {
      setIsSettingPrice(false);
    }
  };

  // Handle extend domain
  const handleExtend = async () => {
    if (!selectedDomain) return;
    setIsExtending(true);
    try {
      await extendDomain(selectedDomain.name, extendYears);
      await fetchAllDomains();
      await fetchBalance();
      // Close modal
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extend domain");
    } finally {
      setIsExtending(false);
    }
  };

  // Handle transfer domain
  const handleTransfer = async () => {
    if (!selectedDomain || !transferTo.trim()) return;
    setIsTransferring(true);
    try {
      await transferDomain(selectedDomain.name, transferTo);
      await fetchAllDomains();
      setIsModalOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to transfer domain",
      );
    } finally {
      setIsTransferring(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      await withdraw();
      await fetchClaimableBalance();
      await fetchBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to withdraw");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const features = [
    {
      icon: <Globe className="w-6 h-6 text-sky-500" />,
      title: "Decentralized Domains",
      description:
        "Register .linera domains on the Linera blockchain. Your domain is truly yours, secured by cryptography.",
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title: "Domain Marketplace",
      description:
        "Set prices for your domains and sell them directly to other users. Buy domains listed for sale instantly.",
    },
    {
      icon: <Shield className="w-6 h-6 text-teal-500" />,
      title: "Full Control",
      description:
        "Manage your domains with complete control - extend registration, set custom values, transfer ownership, or list for sale.",
    },
  ];

  const isConnected = mounted && isLoggedIn && chainConnected && appConnected;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 selection:bg-sky-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 overflow-hidden rounded-lg">
                <Image
                  src="/logo.png"
                  alt="LNS Logo"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-teal-500">
                LNS
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a
                href="#features"
                className="hover:text-sky-500 transition-colors"
              >
                Features
              </a>
              {isConnected && (
                <a
                  href="#my-domains"
                  className="hover:text-sky-500 transition-colors"
                >
                  My Domains
                </a>
              )}
              <DynamicWidget />
            </div>

            {/* Mobile Nav Toggle */}
            <div className="md:hidden flex items-center gap-2">
              <DynamicWidget />
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2"
              >
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <a href="#features" className="block text-lg">
              Features
            </a>
            {isConnected && (
              <a href="#my-domains" className="block text-lg">
                My Domains
              </a>
            )}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-sky-50/50 to-transparent dark:from-sky-900/10 -z-10" />
        <div className="absolute top-40 left-1/4 w-64 h-64 bg-sky-400/10 blur-[100px] rounded-full -z-10" />
        <div className="absolute top-60 right-1/4 w-64 h-64 bg-teal-400/10 blur-[100px] rounded-full -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              Claim Your <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-600 via-sky-500 to-teal-400">
                .linera Domain
              </span>
            </h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Linera Name System lets you claim your unique .linera domain.
              Secure your identity on the Linera blockchain.
            </p>
          </motion.div>

          {/* Connection Status */}
          {mounted && isLoggedIn && !isConnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to Linera...</span>
            </motion.div>
          )}

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-teal-500 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition-opacity" />
              <div className="relative flex items-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
                <Search className="ml-5 w-6 h-6 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search for a .linera domain..."
                  className="w-full px-4 py-5 bg-transparent border-none focus:ring-0 text-lg outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={!isConnected || isSearching || !searchQuery.trim()}
                  className="mr-3 px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-zinc-500">
              <span>Examples:</span>
              <button
                type="button"
                onClick={() => handleExampleClick("alice.linera")}
                className="hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                alice.linera
              </button>
              <button
                type="button"
                onClick={() => handleExampleClick("bob.linera")}
                className="hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                bob.linera
              </button>
              <button
                type="button"
                onClick={() => handleExampleClick("wallet.linera")}
                className="hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                wallet.linera
              </button>
              <button
                type="button"
                onClick={() => handleExampleClick("defi.linera")}
                className="hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                defi.linera
              </button>
            </div>

            {/* Not connected message */}
            {mounted && !isLoggedIn && (
              <p className="mt-4 text-sm text-zinc-500">
                Connect your wallet to search and register domains
              </p>
            )}
          </motion.div>

          {/* Search Results */}
          <AnimatePresence>
            {(searchResult || searchError) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto mt-6"
              >
                {searchError ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-700 dark:text-red-300">
                      {searchError}
                    </span>
                  </div>
                ) : searchResult?.IsAvailable ? (
                  <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <Check className="w-6 h-6 text-green-500" />
                        <div className="text-left">
                          <p className="font-semibold text-green-700 dark:text-green-300">
                            {searchQuery.toLowerCase().replace(".linera", "")}
                            .linera is available!
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            Registration fee: {registrationFee} LINERA
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRegister}
                        disabled={isRegistering}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isRegistering ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Registering...
                          </>
                        ) : (
                          "Register Now"
                        )}
                      </button>
                    </div>
                  </div>
                ) : searchResult?.domain ? (
                  <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle className="w-6 h-6 text-amber-500" />
                      <p className="font-semibold text-amber-700 dark:text-amber-300">
                        {searchResult.domain.name}.linera is taken
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-left mb-4">
                      <div>
                        <span className="text-zinc-500">Owner:</span>
                        <p className="font-mono text-xs truncate">
                          {searchResult.domain.owner}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Expires:</span>
                        <p>
                          {formatExpiration(searchResult.domain.expiration)}
                        </p>
                      </div>
                      {searchResult.domain.value && (
                        <div className="col-span-2">
                          <span className="text-zinc-500">Value:</span>
                          <p className="truncate">
                            {searchResult.domain.value}
                          </p>
                        </div>
                      )}
                    </div>
                    {searchResult.domain.isForSale && (
                      <div className="flex items-center justify-between border-t border-amber-200 dark:border-amber-700 pt-4">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                          <Tag className="w-4 h-4" />
                          <span className="font-semibold">
                            For Sale: {formatPrice(searchResult.domain.price)}{" "}
                            LINERA
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleBuy}
                          disabled={
                            isBuying ||
                            searchResult.domain.owner.toLowerCase() ===
                              primaryWallet?.address?.toLowerCase()
                          }
                          className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isBuying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Buying...
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4" />
                              Buy Now
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto mt-4"
              >
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-700 dark:text-red-300">
                      {error}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* My Domains Section */}
      {isConnected && (
        <section
          id="my-domains"
          className="py-16 bg-zinc-50 dark:bg-zinc-900/30"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <h2 className="text-3xl font-bold">My Domains</h2>
              <div className="flex items-center gap-4 flex-wrap">
                {/* Balance Display */}
                <div className="px-4 py-2 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                  <span className="text-sm text-zinc-500">Balance:</span>
                  <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
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
                    className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  >
                    Refresh
                  </button>
                </div>

                {/* Claimable Balance Display */}
                <div className="px-4 py-2 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                  <span className="text-sm text-zinc-500">Claimable:</span>
                  <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                    {isLoadingClaimable
                      ? "Loading..."
                      : claimableBalance !== null
                        ? `${formatPrice(claimableBalance)} LINERA`
                        : "..."}
                  </code>
                  <button
                    type="button"
                    onClick={fetchClaimableBalance}
                    disabled={isLoadingClaimable}
                    className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleWithdraw}
                    disabled={
                      isWithdrawing ||
                      !claimableBalance ||
                      claimableBalance === "0" ||
                      formatPrice(claimableBalance) === "0"
                    }
                    className="rounded bg-green-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isWithdrawing ? "Withdrawing..." : "Withdraw"}
                  </button>
                </div>
              </div>
            </div>

            {/* Domains Grid */}
            {isLoadingDomains ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
              </div>
            ) : myDomains.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>You don&apos;t own any domains yet.</p>
                <p className="text-sm">
                  Search for a domain above to get started!
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myDomains.map((domain) => (
                  <motion.div
                    key={domain.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => openDomainModal(domain)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-bold text-sky-600 dark:text-sky-400">
                        {domain.name}.linera
                      </h3>
                      {domain.isForSale && (
                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                          For Sale
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Clock className="w-4 h-4" />
                        <span>
                          Expires: {formatExpiration(domain.expiration)}
                        </span>
                        {domain.isExpired && (
                          <span className="text-red-500 font-semibold">
                            (Expired)
                          </span>
                        )}
                      </div>
                      {domain.value && (
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Edit3 className="w-4 h-4" />
                          <span className="truncate">
                            Value: {domain.value}
                          </span>
                        </div>
                      )}
                      {domain.isForSale && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <Tag className="w-4 h-4" />
                          <span>Price: {formatPrice(domain.price)} LINERA</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center text-sm text-zinc-400">
                      Click to manage
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section id="features" className="py-24 bg-zinc-50 dark:bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose LNS?</h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              The Linera Name System provides a decentralized way to own and
              manage your digital identity on the Linera blockchain.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 overflow-hidden rounded-md opacity-70">
              <Image
                src="/logo.png"
                alt="LNS Logo"
                fill
                className="object-cover"
              />
            </div>
            <span className="font-bold text-zinc-500 uppercase tracking-widest text-xs">
              Linera Name System
            </span>
          </div>
          <div className="flex gap-8 text-sm text-zinc-500">
            <a
              href="https://github.com"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://linera.io"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Linera
            </a>
            <a
              href="https://twitter.com"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Twitter
            </a>
            <a
              href="https://discord.com"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Discord
            </a>
          </div>
          <p className="text-sm text-zinc-500">
            © 2024 LNS Foundation. Built on Linera.
          </p>
        </div>
      </footer>

      {/* Domain Management Modal */}
      <AnimatePresence>
        {isModalOpen && selectedDomain && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                    {selectedDomain.name}.linera
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-zinc-500 mt-1">
                  Expires: {formatExpiration(selectedDomain.expiration)}
                  {selectedDomain.isExpired && (
                    <span className="text-red-500 ml-2">(Expired)</span>
                  )}
                </p>
              </div>

              {/* Modal Tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                {(["manage", "extend", "transfer", "sell"] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setModalTab(tab)}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        modalTab === tab
                          ? "text-sky-600 dark:text-sky-400 border-b-2 border-sky-500"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ),
                )}
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {modalTab === "manage" && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="domain-value-input"
                        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                      >
                        Domain Value (e.g., wallet address, website URL)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="domain-value-input"
                          type="text"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          placeholder="Enter a value for this domain"
                          className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-none focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSetValue}
                          disabled={isSettingValue}
                          className="px-4 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isSettingValue ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Edit3 className="w-4 h-4" />
                          )}
                          Set
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === "extend" && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="extend-years-select"
                        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                      >
                        Extend Registration
                      </label>
                      <div className="flex items-center gap-4">
                        <select
                          id="extend-years-select"
                          value={extendYears}
                          onChange={(e) =>
                            setExtendYears(Number(e.target.value))
                          }
                          className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-none focus:ring-2 focus:ring-sky-500 outline-none"
                        >
                          {[1, 2, 3, 4, 5].map((y) => (
                            <option key={y} value={y}>
                              {y} year{y > 1 ? "s" : ""}
                            </option>
                          ))}
                        </select>
                        <span className="text-zinc-500">
                          Cost: {(extendYears * registrationFee).toFixed(1)}{" "}
                          LINERA
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExtend}
                      disabled={isExtending}
                      className="w-full px-4 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isExtending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Extending...
                        </>
                      ) : (
                        <>
                          <Calendar className="w-4 h-4" />
                          Extend Registration
                        </>
                      )}
                    </button>
                  </div>
                )}

                {modalTab === "transfer" && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="transfer-to-input"
                        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                      >
                        Transfer to Address
                      </label>
                      <input
                        id="transfer-to-input"
                        type="text"
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-none focus:ring-2 focus:ring-sky-500 outline-none font-mono text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleTransfer}
                      disabled={isTransferring || !transferTo.trim()}
                      className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isTransferring ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Transferring...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Transfer Domain
                        </>
                      )}
                    </button>
                    <p className="text-sm text-zinc-500 text-center">
                      Warning: This action cannot be undone!
                    </p>
                  </div>
                )}

                {modalTab === "sell" && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="sale-price-input"
                        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                      >
                        Sale Price (LINERA)
                      </label>
                      <input
                        id="sale-price-input"
                        type="text"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-none focus:ring-2 focus:ring-sky-500 outline-none"
                      />
                      <p className="text-sm text-zinc-500 mt-2">
                        Set to 0 to remove from sale
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSetPrice}
                      disabled={isSettingPrice}
                      className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSettingPrice ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Setting Price...
                        </>
                      ) : (
                        <>
                          <Tag className="w-4 h-4" />
                          {parseFloat(newPrice) > 0
                            ? "List for Sale"
                            : "Remove from Sale"}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
