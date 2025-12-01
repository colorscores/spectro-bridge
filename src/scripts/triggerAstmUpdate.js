// Trigger the ASTM update process in browser context
import { executeAstmUpdate } from './executeAstmUpdate';

console.log('[TRIGGER] Starting ASTM E308 data update...');

executeAstmUpdate()
  .then(result => {
    console.log('[TRIGGER] ✅ ASTM update completed successfully!', result);
    
    console.log('[VERIFICATION] Update completed, caches cleared');
  })
  .catch(error => {
    console.error('[TRIGGER] ❌ ASTM update failed:', error);
  });

export {}; // Make this a module