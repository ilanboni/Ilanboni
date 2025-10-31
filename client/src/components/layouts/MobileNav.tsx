import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function MobileNav() {
  const [location] = useLocation();

  // Function to check if a link is active
  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10 pb-safe">
      <div className="flex justify-around" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <NavItem to="/" icon="fas fa-tachometer-alt" label="Home" />
        <NavItem to="/clients" icon="fas fa-users" label="Clienti" />
        <NavItem to="/properties" icon="fas fa-building" label="Immobili" />
        <NavItem to="/appointments" icon="fas fa-calendar-alt" label="Agenda" />
        <NavItem to="/tasks" icon="fas fa-tasks" label="Task" />
      </div>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
}

function NavItem({ to, icon, label }: NavItemProps) {
  const [location] = useLocation();
  const active = to === "/" ? location === "/" : location.startsWith(to);

  return (
    <Link href={to}>
      <div className={cn(
        "flex flex-col items-center justify-center py-2.5 px-3 cursor-pointer min-h-[56px] min-w-[60px] no-select transition-colors",
        active ? "text-primary-600" : "text-gray-500 hover:text-gray-700 active:bg-gray-100"
      )}>
        <i className={cn("text-xl mb-0.5", icon)}></i>
        <span className="text-[10px] font-medium leading-tight">{label}</span>
      </div>
    </Link>
  );
}
