import React from "react";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header 
      className="bg-white border-b border-gray-200 sticky top-0 z-20"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
        {/* Mobile Menu Toggle */}
        <button 
          onClick={onMenuClick} 
          className="md:hidden text-gray-600 tap-target no-select active:bg-gray-100 rounded-lg -ml-2"
          aria-label="Menu"
        >
          <i className="fas fa-bars text-xl"></i>
        </button>
        
        {/* Logo/Title on mobile */}
        <div className="md:hidden flex-1 text-center">
          <span className="text-base font-semibold text-gray-900">RE CRM</span>
        </div>
        
        {/* Search Input - Desktop only */}
        <div className="hidden md:flex w-64 lg:w-96 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <i className="fas fa-search text-gray-400"></i>
          </span>
          <Input 
            type="text" 
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md bg-gray-50" 
            placeholder="Cerca clienti, immobili..." 
          />
        </div>
        
        {/* Right Actions */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button 
            className="relative tap-target text-gray-400 rounded-lg hover:bg-gray-100 hover:text-gray-500 active:bg-gray-200 no-select transition-colors"
            aria-label="Notifiche"
          >
            <i className="fas fa-bell text-lg"></i>
            <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>
          
          <button 
            className="tap-target text-gray-400 rounded-lg hover:bg-gray-100 hover:text-gray-500 active:bg-gray-200 no-select transition-colors hidden sm:flex"
            aria-label="Messaggi"
          >
            <i className="fas fa-envelope text-lg"></i>
          </button>
          
          {/* Profile */}
          <button className="flex items-center tap-target no-select rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors -mr-2">
            <img 
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover ring-2 ring-gray-100" 
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200" 
              alt="Profile" 
            />
          </button>
        </div>
      </div>
    </header>
  );
}
