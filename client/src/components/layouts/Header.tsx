import React from "react";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Mobile Menu Toggle */}
        <button onClick={onMenuClick} className="md:hidden text-gray-600">
          <i className="fas fa-bars text-xl"></i>
        </button>
        
        {/* Search Input */}
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
        <div className="flex items-center space-x-4">
          <button className="relative p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <i className="fas fa-bell"></i>
            <span className="absolute top-1 right-2 block h-2 w-2 rounded-full bg-red-500"></span>
          </button>
          
          <button className="p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <i className="fas fa-envelope"></i>
          </button>
          
          {/* Mobile only profile */}
          <button className="md:hidden flex items-center">
            <img 
              className="h-8 w-8 rounded-full object-cover" 
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200" 
              alt="Profile image" 
            />
          </button>
        </div>
      </div>
    </header>
  );
}
