import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export function useAppointmentFollowUp() {
  const [showPopup, setShowPopup] = useState(false);
  
  // TEMPORANEAMENTE DISABILITATO per risolvere problemi di caricamento
  // Verifica se ci sono appuntamenti che necessitano follow-up
  const { data: pendingAppointments = [] } = useQuery({
    queryKey: ['/api/appointment-confirmations/pending-follow-up'],
    enabled: false, // DISABILITATO TEMPORANEAMENTE
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000
  });

  // Mostra il popup se ci sono appuntamenti in sospeso
  useEffect(() => {
    const appointments = pendingAppointments as any[];
    if (appointments.length > 0 && !showPopup) {
      setShowPopup(true);
    }
  }, [(pendingAppointments as any[]).length, showPopup]);

  return {
    showPopup,
    setShowPopup,
    hasPendingAppointments: (pendingAppointments as any[]).length > 0
  };
}