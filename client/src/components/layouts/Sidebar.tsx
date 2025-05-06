import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();

  // Function to check if a link is active
  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  // Sidebar link component
  const SidebarLink = ({ 
    to, 
    icon, 
    children 
  }: { 
    to: string; 
    icon: string; 
    children: React.ReactNode 
  }) => (
    <Link href={to}>
      <a
        className={cn(
          "flex items-center px-4 py-3 text-sm font-medium",
          isActive(to)
            ? "text-primary-700 bg-primary-50 border-l-4 border-primary-600"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )}
      >
        <i className={cn(
          icon, 
          "w-6", 
          isActive(to) ? "text-primary-600" : "text-gray-400"
        )}></i>
        <span>{children}</span>
      </a>
    </Link>
  );

  return (
    <aside className={cn("flex-col w-64 bg-white border-r border-gray-200", className)}>
      {/* Logo Area */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="bg-primary-600 text-white p-2 rounded-md">
            <i className="fas fa-home text-xl"></i>
          </div>
          <h1 className="font-heading font-semibold text-xl text-gray-800">RealEstate CRM</h1>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 pt-4 pb-4 overflow-y-auto scrollbar-hide">
        <div className="px-4 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Principale
        </div>
        
        <SidebarLink to="/" icon="fas fa-tachometer-alt">Dashboard</SidebarLink>
        <SidebarLink to="/clients" icon="fas fa-users">Clienti</SidebarLink>
        <SidebarLink to="/properties" icon="fas fa-building">Immobili</SidebarLink>
        <SidebarLink to="/appointments" icon="fas fa-calendar-alt">Appuntamenti</SidebarLink>
        <SidebarLink to="/communications" icon="fas fa-comments">Comunicazioni</SidebarLink>
        <SidebarLink to="/tasks" icon="fas fa-tasks">Task e Alert</SidebarLink>
        
        <div className="px-4 mt-6 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Analisi e Strumenti
        </div>
        
        <SidebarLink to="/analytics" icon="fas fa-chart-pie">Analisi di Mercato</SidebarLink>
        <SidebarLink to="/maps" icon="fas fa-map-marked-alt">Mappe e Ricerca</SidebarLink>
        <SidebarLink to="/settings" icon="fas fa-cog">Impostazioni</SidebarLink>
      </nav>
      
      {/* User Profile */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center">
          <img 
            className="h-8 w-8 rounded-full object-cover" 
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200" 
            alt="Profile image" 
          />
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700">Marco Rossi</p>
            <p className="text-xs text-gray-500">Agente immobiliare</p>
          </div>
          <button className="ml-auto text-gray-400 hover:text-gray-600">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
