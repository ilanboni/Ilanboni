import React from 'react';

interface PreferenceDetailsProps {
  preferences: any;
}

const PreferenceDetails: React.FC<PreferenceDetailsProps> = ({ preferences }) => {
  if (!preferences) return null;
  
  return (
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
  );
};

export default PreferenceDetails;