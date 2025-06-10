import React from 'react';
import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PreferenceDetailsProps {
  preferences: any;
}

const PreferenceDetails: React.FC<PreferenceDetailsProps> = ({ preferences }) => {
  if (!preferences) return null;

  // Funzione per estrarre informazioni dall'area di ricerca
  const getSearchAreaInfo = (searchArea: any) => {
    if (!searchArea) return null;
    
    if (typeof searchArea === 'object' && searchArea.type === 'Polygon') {
      // GeoJSON Polygon - cerchiamo di estrarre un nome o coordinate rappresentative
      const coordinates = searchArea.coordinates?.[0];
      if (coordinates && coordinates.length > 0) {
        const centerLat = coordinates.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coordinates.length;
        const centerLng = coordinates.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coordinates.length;
        return {
          type: 'Zona personalizzata',
          center: `${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`,
          coordinates: coordinates.length - 1 // -1 perché il primo e ultimo punto sono uguali
        };
      }
    }
    
    if (typeof searchArea === 'object' && searchArea.type === 'circle') {
      // Formato area circolare con centro lat/lng o indirizzo
      if (searchArea.center && typeof searchArea.center === 'object' && searchArea.center.lat && searchArea.center.lng) {
        return {
          type: 'Area circolare',
          center: `${searchArea.center.lat.toFixed(4)}, ${searchArea.center.lng.toFixed(4)}`,
          radius: searchArea.radius || 600,
          address: searchArea.address || 'Posizione geografica'
        };
      } else if (searchArea.center && typeof searchArea.center === 'string') {
        return {
          type: 'Area circolare',
          center: searchArea.center,
          radius: searchArea.radius || 600
        };
      }
    }
    
    if (typeof searchArea === 'object' && (searchArea.lat || searchArea.lng)) {
      // Formato punto con raggio (legacy)
      return {
        type: 'Area circolare',
        center: `${searchArea.lat?.toFixed(4)}, ${searchArea.lng?.toFixed(4)}`,
        radius: searchArea.radius || 600
      };
    }
    
    return null;
  };

  const searchAreaInfo = getSearchAreaInfo(preferences.searchArea);
  
  return (
    <div className="space-y-6">
      {/* Area di ricerca - se presente */}
      {searchAreaInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-medium text-blue-900">Area di Ricerca</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Tipo:</span>
              <div className="text-blue-800">{searchAreaInfo.type}</div>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Centro:</span>
              <div className="text-blue-800 font-mono text-xs">{searchAreaInfo.center}</div>
            </div>
            {searchAreaInfo.radius && (
              <div>
                <span className="text-blue-700 font-medium">Raggio:</span>
                <div className="text-blue-800">{searchAreaInfo.radius}m</div>
              </div>
            )}
            {searchAreaInfo.coordinates && (
              <div>
                <span className="text-blue-700 font-medium">Punti:</span>
                <div className="text-blue-800">{searchAreaInfo.coordinates} coordinate</div>
              </div>
            )}
          </div>
          <Badge variant="secondary" className="mt-2 text-xs">
            Creata automaticamente da email
          </Badge>
        </div>
      )}
      
      {/* Preferenze esistenti */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Budget</h3>
          <p>
            {preferences.minPrice && preferences.maxPrice
              ? `${preferences.minPrice.toLocaleString('it-IT')} € - ${preferences.maxPrice.toLocaleString('it-IT')} €`
              : preferences.maxPrice
              ? `Fino a ${preferences.maxPrice.toLocaleString('it-IT')} €`
              : "Non specificato"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Superficie</h3>
          <p>
            {preferences.minSize && preferences.maxSize
              ? `${preferences.minSize} m² - ${preferences.maxSize} m²`
              : preferences.minSize
              ? `Minimo ${preferences.minSize} m²`
              : "Non specificata"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Locali</h3>
          <p>
            {preferences.minRooms
              ? `Minimo ${preferences.minRooms} ${preferences.minRooms === 1 ? 'locale' : 'locali'}`
              : "Non specificati"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Tipologia</h3>
          <p>{preferences.propertyType || "Qualsiasi"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Stato Immobile</h3>
          <p>{preferences.condition || "Qualsiasi"}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Piano</h3>
          <p>
            {preferences.minFloor !== undefined && preferences.maxFloor !== undefined
              ? `${preferences.minFloor === 0 ? 'PT' : preferences.minFloor} - ${preferences.maxFloor === 0 ? 'PT' : preferences.maxFloor}`
              : preferences.minFloor !== undefined
              ? `Min. ${preferences.minFloor === 0 ? 'PT' : preferences.minFloor}`
              : preferences.maxFloor !== undefined
              ? `Max. ${preferences.maxFloor === 0 ? 'PT' : preferences.maxFloor}`
              : "Qualsiasi"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Bagni</h3>
          <p>
            {preferences.minBathrooms
              ? `Minimo ${preferences.minBathrooms}`
              : "Qualsiasi"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Balconi</h3>
          <p>
            {preferences.hasBalcony !== undefined
              ? preferences.hasBalcony
                ? "Richiesto"
                : "Non richiesto"
              : "Indifferente"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Terrazzo</h3>
          <p>
            {preferences.hasTerrace !== undefined
              ? preferences.hasTerrace
                ? "Richiesto"
                : "Non richiesto"
              : "Indifferente"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Giardino</h3>
          <p>
            {preferences.hasGarden !== undefined
              ? preferences.hasGarden
                ? "Richiesto"
                : "Non richiesto"
              : "Indifferente"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Garage/Box</h3>
          <p>
            {preferences.hasGarage !== undefined
              ? preferences.hasGarage
                ? "Richiesto"
                : "Non richiesto"
              : "Indifferente"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Ascensore</h3>
          <p>
            {preferences.hasElevator !== undefined
              ? preferences.hasElevator
                ? "Richiesto"
                : "Non richiesto"
              : "Indifferente"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PreferenceDetails;