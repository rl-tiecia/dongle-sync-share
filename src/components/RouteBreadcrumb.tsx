import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

const labels: Record<string, string> = {
  "": "Dashboard",
  backups: "Backups",
  network: "Destinos de Rede",
  agents: "Agentes",
  logs: "Logs",
  profile: "Meu Perfil",
  settings: "Configurações",
  users: "Usuários",
  admin: "Admin",
  devices: "Dispositivos",
};

export function RouteBreadcrumb() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);

  return (
    <nav className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link to="/" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
        <span>Início</span>
      </Link>
      {parts.map((p, i) => {
        const path = "/" + parts.slice(0, i + 1).join("/");
        const last = i === parts.length - 1;
        return (
          <Fragment key={path}>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            {last ? (
              <span className="font-medium text-foreground">{labels[p] || p}</span>
            ) : (
              <Link to={path} className="hover:text-foreground transition-colors">
                {labels[p] || p}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
