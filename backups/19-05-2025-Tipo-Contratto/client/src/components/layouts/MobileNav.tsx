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
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
      <div className="flex justify-around">
        <NavItem to="/" icon="fas fa-tachometer-alt" label="Dashboard" />
        <NavItem to="/clients" icon="fas fa-users" label="Clienti" />
        <NavItem to="/properties" icon="fas fa-building" label="Immobili" />
        <NavItem to="/appointments" icon="fas fa-calendar-alt" label="Agenda" />
        <NavItem to="/tasks" icon="fas fa-ellipsis-h" label="Altro" />
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
        "flex flex-col items-center py-3 px-4 cursor-pointer",
        active ? "text-primary-600" : "text-gray-500"
      )}>
        <i className={`${icon} text-lg`}></i>
        <span className="text-xs mt-1">{label}</span>
      </div>
    </Link>
  );
}
