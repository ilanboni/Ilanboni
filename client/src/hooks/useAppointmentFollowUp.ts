import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export function useAppointmentFollowUp() {
  const [showPopup, setShowPopup] = useState(false);
  
  // Verifica se ci sono appuntamenti che necessitano follow-up
  const { data: pendingAppointments = [] } = useQuery({
    queryKey: ['/api/appointment-confirmations/pending-follow-up'],
    refetchInterval: 5 * 60 * 1000, // Controlla ogni 5 minuti
    staleTime: 2 * 60 * 1000 // I dati sono considerati freschi per 2 minuti
  });

  // Mostra il popup se ci sono appuntamenti in sospeso
  useEffect(() => {
    if (pendingAppointments.length > 0 && !showPopup) {
      setShowPopup(true);
    }
  }, [pendingAppointments.length, showPopup]);

  return {
    showPopup,
    setShowPopup,
    hasPendingAppointments: pendingAppointments.length > 0
  };
}