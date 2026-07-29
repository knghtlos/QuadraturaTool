"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ImportExportActions } from "@/components/import-export-actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { navigationItems } from "@/lib/sheets";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleSearch(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value.trim()) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    window.dispatchEvent(new CustomEvent("governance:global-search", { detail: value }));
  }

  const navLinks = navigationItems.map((item) => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          active && "bg-accent text-accent-foreground"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.title}</span>
      </Link>
    );
  });

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-white/90 backdrop-blur lg:block">
        <div className="flex h-16 items-center border-b px-4">
          <Link href="/" className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Quadrature Tool</div>
            <div className="text-xs text-muted-foreground">Workbook operativo</div>
          </Link>
        </div>
        <nav className="space-y-1 p-3">
          {navLinks}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b bg-white/90 px-3 py-2 backdrop-blur sm:px-4 lg:flex lg:h-16 lg:items-center lg:gap-3 lg:py-0">
          <div className="mb-2 flex items-center justify-between gap-3 lg:hidden">
            <Link href="/" className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">Quadrature Tool</div>
              <div className="truncate text-xs text-muted-foreground">Workbook operativo</div>
            </Link>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:flex-1">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 w-full pl-9 lg:max-w-2xl"
                placeholder="Cerca"
                defaultValue={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : ""}
                onChange={(event) => handleSearch(event.target.value)}
              />
            </div>
            <ImportExportActions />
          </div>

          <nav className="-mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-1 scrollbar-thin sm:-mx-4 sm:px-4 lg:hidden">
            {navLinks}
          </nav>
        </header>

        <main className="min-w-0 flex-1 px-3 py-3 sm:px-4 sm:py-4 md:px-6">{children}</main>
      </div>
    </div>
  );
}
