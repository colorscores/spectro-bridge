// Manual execution script for substrate condition modes backfill
import { backfillCurrentSubstrateCondition } from './substrateConditionBackfill';

export const runCurrentSubstrateConditionBackfill = async () => {
  try {
    console.log('🚀 Starting substrate condition modes backfill for current condition...');
    
    const result = await backfillCurrentSubstrateCondition();
    
    console.log('🎉 Backfill completed successfully!', result);
    
    return result;
  } catch (error) {
    console.error('💥 Backfill failed:', error);
    throw error;
  }
};