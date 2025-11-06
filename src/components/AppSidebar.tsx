import { Home, HardDrive, Settings, FileText, Users } from "lucide-react";
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

const items = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Backups", url: "/backups", icon: HardDrive },
  { title: "Logs", url: "/logs", icon: FileText },
  { title: "Usuários", url: "/users", icon: Users, adminOnly: true },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { isAdmin } = useUserRole();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-primary font-semibold">
            T-Dongle S3
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                if (item.adminOnly && !isAdmin) return null;
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <NavLink
                      to={item.url}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 rounded-md transition-all relative",
                        active 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:bg-sidebar-primary before:rounded-r" 
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
