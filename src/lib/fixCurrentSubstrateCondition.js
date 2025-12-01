// One-time fix script for the current substrate condition
import { supabase } from '@/integrations/supabase/client';
import { fixSubstrateCondition } from './substrateConditionFixer';

export const fixCurrentCondition = async () => {
  const conditionId = 'c449a161-2b91-4928-b616-f35b3b64a99e';
  
  try {
    console.log('🚀 Starting fix for substrate condition:', conditionId);
    
    const result = await fixSubstrateCondition(conditionId);
    
    console.log('🎉 Fix completed successfully!', result);
    
    // Verify the fix by checking the condition
    const { data: verified, error } = await supabase
      .from('substrate_conditions')
      .select('spectral_data, lab, ch, color_hex')
      .eq('id', conditionId)
      .single();
      
    if (!error && verified) {
      console.log('✅ Verification passed:', {
        hasSpectralData: !!(verified.spectral_data && Object.keys(verified.spectral_data).length > 0),
        hasLab: !!verified.lab,
        hasCh: !!verified.ch,
        hasColorHex: !!verified.color_hex,
        spectralDataPoints: verified.spectral_data ? Object.keys(verified.spectral_data).length : 0
      });
    }
    
    return result;
  } catch (error) {
    console.error('💥 Fix failed:', error);
    throw error;
  }
};

// Auto-run the fix when this module is imported
if (typeof window !== 'undefined') {
  // Only run in browser environment
  setTimeout(() => {
    fixCurrentCondition().catch(console.error);
  }, 1000);
}