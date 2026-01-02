"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Globe, Shield, Zap, ChevronRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const features = [
    {
      icon: <Globe className="w-6 h-6 text-sky-500" />,
      title: "Universal TLDs",
      description: "Buy and own entire TLDs like .com or .web3. You have full control over the registry.",
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title: "Subdomain Economy",
      description: "Rent subdomains to others. Create a recurring revenue stream from your TLD ownership.",
    },
    {
      icon: <Shield className="w-6 h-6 text-teal-500" />,
      title: "True Ownership",
      description: "Unlike ICANN, no one can revoke your TLD. It's a permanent asset on the Linera blockchain.",
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 selection:bg-sky-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 overflow-hidden rounded-lg">
                <Image src="/logo.png" alt="LNS Logo" fill className="object-cover" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-teal-500">
                LNS
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a href="#features" className="hover:text-sky-500 transition-colors">Features</a>
              <a href="#about" className="hover:text-sky-500 transition-colors">About</a>
              <DynamicWidget />
            </div>

            {/* Mobile Nav Toggle */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <a href="#features" className="block text-lg">Features</a>
            <a href="#about" className="block text-lg">About</a>
            <DynamicWidget />
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
              Linera Name System lets you claim your unique .linera domain. Secure your identity on the Linera blockchain.
            </p>
          </motion.div>

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
                  placeholder="Search for a domain or whole TLD (e.g. .com)..."
                  className="w-full px-4 py-5 bg-transparent border-none focus:ring-0 text-lg outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="mr-3 px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-semibold hover:opacity-90 transition-opacity">
                  Search
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-zinc-500">
              <span>Examples:</span>
              <button className="hover:text-zinc-900 dark:hover:text-white transition-colors">alice.linera</button>
              <button className="hover:text-zinc-900 dark:hover:text-white transition-colors">bob.linera</button>
              <button className="hover:text-zinc-900 dark:hover:text-white transition-colors">wallet.linera</button>
              <button className="hover:text-zinc-900 dark:hover:text-white transition-colors">defi.linera</button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-zinc-50 dark:bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            {features.map((feature, index) => (
              <motion.div
                key={index}
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
              <Image src="/logo.png" alt="LNS Logo" fill className="object-cover" />
            </div>
            <span className="font-bold text-zinc-500 uppercase tracking-widest text-xs">
              Linera Name System
            </span>
          </div>
          <div className="flex gap-8 text-sm text-zinc-500">
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Discord</a>
          </div>
          <p className="text-sm text-zinc-500">
            © 2024 LNS Foundation. Built on Linera.
          </p>
        </div>
      </footer>
    </div>
  );
}
