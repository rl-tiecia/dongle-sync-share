import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RouteBreadcrumb } from "@/components/RouteBreadcrumb";
import { Search } from "lucide-react";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/40 bg-background/60 backdrop-blur-xl backdrop-saturate-150 px-4">
      <SidebarTrigger className="h-9 w-9 rounded-md hover:bg-accent/10" />
      <div className="h-5 w-px bg-border/60" />
      <RouteBreadcrumb />
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-full glass text-xs text-muted-foreground w-56 transition-all hover:w-64">
          <Search className="h-3.5 w-3.5" />
          <span>Buscar...</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-muted/50">⌘K</kbd>
        </div>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
