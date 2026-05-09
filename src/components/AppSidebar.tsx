import { Home, HardDrive, Settings, FileText, Users, MonitorCog, UserCircle, Network, Bot, Zap, Shield } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Backups", url: "/backups", icon: HardDrive },
  { title: "Destinos de Rede", url: "/network", icon: Network },
  { title: "Agentes", url: "/agents", icon: Bot },
  { title: "Logs", url: "/logs", icon: FileText },
];

const accountItems = [
  { title: "Meu Perfil", url: "/profile", icon: UserCircle },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Usuários", url: "/users", icon: Users },
  { title: "Dispositivos", url: "/admin/devices", icon: MonitorCog },
  { title: "Roles & Permissões", url: "/permissions", icon: Shield },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { isAdmin } = useUserRole();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const renderItem = (item: { title: string; url: string; icon: typeof Home }) => {
    const active = isActive(item.url);
    return (
      <SidebarMenuItem key={item.title}>
        <NavLink
          to={item.url}
          className={cn(
            "group relative flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-200",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
          )}
        >
          {active && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
          )}
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              active ? "bg-primary/15 text-primary" : "text-current group-hover:bg-sidebar-accent/30",
            )}
          >
            <item.icon className="h-4 w-4" />
          </div>
          {open && <span className="text-sm">{item.title}</span>}
        </NavLink>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarContent className="bg-sidebar/95 backdrop-blur-xl">
        {/* Brand */}
        <div className={cn("flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border/60", !open && "justify-center px-2")}>
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          {open && (
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight gradient-text">T-Dongle S3</p>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Monitor</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          {open && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3 mt-2">Principal</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2">{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {open && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3">Conta</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2">{accountItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            {open && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3">Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 px-2">{adminItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {open && (
          <div className="mt-auto border-t border-sidebar-border/60 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Conectado · v1.0
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
