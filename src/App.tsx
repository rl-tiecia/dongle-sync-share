import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Dashboard from "./pages/Dashboard";
import Backups from "./pages/Backups";
import NetworkDestinations from "./pages/NetworkDestinations";
import DeliveryAgents from "./pages/DeliveryAgents";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import AdminDevices from "./pages/AdminDevices";
import Permissions from "./pages/Permissions";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation();
  return (
    <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
      <div key={location.pathname} className="mx-auto max-w-7xl animate-fade-in">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/backups" element={<Backups />} />
          <Route path="/network" element={<NetworkDestinations />} />
          <Route path="/agents" element={<DeliveryAgents />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="/admin/devices" element={<AdminRoute><AdminDevices /></AdminRoute>} />
          <Route path="/permissions" element={<AdminRoute><Permissions /></AdminRoute>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </main>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <AnimatedBackground />
                    <div className="flex min-h-screen w-full">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col min-w-0">
                        <AppTopbar />
                        <AppRoutes />
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
