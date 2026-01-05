import Link from "next/link";
import Image from "next/image";
import { DOCS_MARKDOWN } from "@/lib/docs-content";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export const metadata = {
  title: "API Documentation | Linera Name System",
  description:
    "Learn how to query domain name values from the Linera Name System API.",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100">
      {/* Simple Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
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
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="hover:text-sky-500 transition-colors">
                Home
              </Link>
              <Link
                href="/llms.txt"
                className="hover:text-sky-500 transition-colors text-zinc-500"
              >
                llms.txt
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Documentation Content */}
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <MarkdownRenderer content={DOCS_MARKDOWN} />
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="py-8 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-zinc-500">
          <p>Linera Name System - API Documentation</p>
        </div>
      </footer>
    </div>
  );
}
