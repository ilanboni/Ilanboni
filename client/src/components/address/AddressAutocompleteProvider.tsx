import React, { createContext, useContext, useState } from 'react';
import SimpleAddressAutocomplete from './SimpleAddressAutocomplete';

// Definizione del contesto
interface AddressAutocompleteContextType {
  showAddressSelector: (options: {
    onSelect: (data: { address: string; lat: number; lng: number }) => void;
    initialValue?: string;
    title?: string;
  }) => void;
}

const AddressAutocompleteContext = createContext<AddressAutocompleteContextType | null>(null);

// Hook personalizzato per utilizzare il contesto
export function useAddressAutocomplete() {
  const context = useContext(AddressAutocompleteContext);
  if (!context) {
    throw new Error('useAddressAutocomplete deve essere utilizzato all\'interno di un AddressAutocompleteProvider');
  }
  return context;
}

// Provider component
export function AddressAutocompleteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<{
    onSelect: (data: { address: string; lat: number; lng: number }) => void;
    initialValue?: string;
    title?: string;
  } | null>(null);

  const showAddressSelector = (opts: {
    onSelect: (data: { address: string; lat: number; lng: number }) => void;
    initialValue?: string;
    title?: string;
  }) => {
    setOptions(opts);
    setIsOpen(true);
  };

  const handleSelect = (data: { address: string; lat: number; lng: number }) => {
    if (options?.onSelect) {
      options.onSelect(data);
    }
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <AddressAutocompleteContext.Provider value={{ showAddressSelector }}>
      {children}
      
      {/* Modal di selezione indirizzo */}
      {isOpen && options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{options.title || "Seleziona indirizzo"}</h3>
              <button 
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <SimpleAddressAutocomplete
              onSelect={handleSelect}
              initialValue={options.initialValue || ""}
              className="mb-4"
            />
            
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </AddressAutocompleteContext.Provider>
  );
}