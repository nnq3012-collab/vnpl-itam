"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ReferenceBackLink() {
  const pathname = usePathname();
  if (pathname === "/reference") return null;

  return (
    <Link href="/reference" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
      ← Back to Reference Lists
    </Link>
  );
}
