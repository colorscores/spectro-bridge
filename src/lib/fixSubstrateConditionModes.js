// Manual trigger for substrate condition backfill
import { backfillSubstrateConditionModes } from './substrateConditionBackfill';

// Run the backfill for the current condition
export const fixCurrentSubstrateConditionModes = async () => {
  const currentConditionId = '1a009524-9946-4df0-82f1-90a8d16856f6';
  
  try {
    console.log('🔧 Manually fixing substrate condition modes...');
    const result = await backfillSubstrateConditionModes(currentConditionId);
    console.log('✅ Manual fix completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Manual fix failed:', error);
    throw error;
  }
};

// Auto-run once when imported (will only run if not already fixed)
if (typeof window !== 'undefined') {
  // Run once without page refresh
  fixCurrentSubstrateConditionModes().catch(console.error);
}