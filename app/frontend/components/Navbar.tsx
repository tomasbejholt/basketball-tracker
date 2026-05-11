"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Tracker" },
  { href: "/library", label: "Library" },
  { href: "/model", label: "Model Info" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-orange-500/20">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 font-bold text-lg text-white">
          <span className="text-2xl">🏀</span>
          <span className="tracking-tight">Basketball Tracker</span>
        </Link>
        <div className="flex gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-orange-500/20 text-orange-400"
                  : "text-gray-400 hover:text-orange-400"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
