/**
 * Script per ri-classificare tutte le proprietà Idealista usando il nuovo algoritmo
 * con le parole chiave italiane (proponiamo, disponiamo, etc.)
 */

import { db } from '../db';
import { properties } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { classifyOwnerType } from '../lib/ownerClassification';

async function reclassifyIdealistaProperties() {
  console.log('🔄 Inizio ri-classificazione proprietà Idealista...\n');

  // Prendi tutte le proprietà da Idealista
  const idealistaProperties = await db
    .select()
    .from(properties)
    .where(eq(properties.source, 'idealista'));

  console.log(`📊 Trovate ${idealistaProperties.length} proprietà da Idealista\n`);

  let updated = 0;
  let changedFromPrivateToAgency = 0;
  let remainedPrivate = 0;
  let remainedAgency = 0;

  for (const property of idealistaProperties) {
    const oldOwnerType = property.ownerType;

    // Ri-classifica usando il nuovo algoritmo
    const classification = classifyOwnerType({
      description: property.description || undefined,
      title: property.address || undefined,
    });

    const newOwnerType = classification.ownerType;

    // Se la classificazione è cambiata, aggiorna il database
    if (oldOwnerType !== newOwnerType) {
      await db
        .update(properties)
        .set({
          ownerType: newOwnerType,
          agencyName: classification.agencyName,
          updatedAt: new Date(),
        })
        .where(eq(properties.id, property.id));

      updated++;

      if (oldOwnerType === 'private' && newOwnerType === 'agency') {
        changedFromPrivateToAgency++;
        console.log(`✅ ID ${property.id}: ${oldOwnerType} → ${newOwnerType} (${classification.reasoning})`);
      }
    } else {
      if (newOwnerType === 'private') {
        remainedPrivate++;
      } else {
        remainedAgency++;
      }
    }
  }

  console.log('\n📊 RISULTATI FINALI:');
  console.log(`   - Totale proprietà processate: ${idealistaProperties.length}`);
  console.log(`   - Proprietà aggiornate: ${updated}`);
  console.log(`   - Cambiate da PRIVATE a AGENCY: ${changedFromPrivateToAgency}`);
  console.log(`   - Rimaste PRIVATE: ${remainedPrivate}`);
  console.log(`   - Rimaste AGENCY: ${remainedAgency}`);
  console.log('\n✅ Ri-classificazione completata!\n');
}

// Esegui lo script
reclassifyIdealistaProperties()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Errore durante la ri-classificazione:', error);
    process.exit(1);
  });
