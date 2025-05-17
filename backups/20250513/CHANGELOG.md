Riepilogo delle modifiche fatte al progetto:
Data: 13-05-2025

## Modifiche principali
1. Risolto problema visualizzazione clienti da notificare
2. Aggiunto pulsante 'Invia a tutti' per notifiche massive
3. Implementato aggiornamento automatico tra le tab dopo l'invio
4. Creati nuovi componenti riutilizzabili per gestire le notifiche

## File modificati
- client/src/pages/properties/[id].tsx
- client/src/components/properties/BuyersToNotifyList.tsx (nuovo)
- client/src/components/properties/NotifiedBuyersList.tsx (nuovo)
- client/src/components/properties/SendToAllButton.tsx (nuovo)

## Note
Le modifiche migliorano l'usabilità dell'applicazione permettendo agli agenti di inviare più facilmente le notifiche ai clienti. Il passaggio tra le tab è ora automatico dopo l'invio delle notifiche.
