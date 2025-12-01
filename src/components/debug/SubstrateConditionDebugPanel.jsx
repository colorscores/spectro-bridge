import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { fixSubstrateCondition } from '@/lib/substrateConditionFixer';
import { supabase } from '@/integrations/supabase/client';

const SubstrateConditionDebugPanel = ({ conditionId, onDataRefresh }) => {
  // Safe hook usage with error boundary protection
  let toast;
  try {
    const toastHook = useToast();
    toast = toastHook.toast;
  } catch (error) {
    console.warn('useToast hook failed, using fallback:', error);
    toast = () => {}; // Fallback no-op function
  }
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [needProcessing, setNeedProcessing] = React.useState(false);

  React.useEffect(() => {
    if (!conditionId || conditionId === 'new') return;
    let isMounted = true;
    supabase
      .from('substrate_conditions')
      .select('spectral_data, lab, imported_tints')
      .eq('id', conditionId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('Failed to check substrate condition processing status:', error);
          setNeedProcessing(false);
          return;
        }
        const needs = !data?.spectral_data && !data?.lab && !!data?.imported_tints;
        setNeedProcessing(Boolean(needs));
      });
    return () => { isMounted = false; };
  }, [conditionId]);

  const handleProcessData = async () => {
    if (!conditionId || conditionId === 'new') return;

    setIsProcessing(true);
    try {
      console.log('🔧 Processing substrate condition data...');
      await fixSubstrateCondition(conditionId);
      
      toast({
        title: 'Data Processed',
        description: 'Successfully processed imported data for substrate condition.',
      });

      // Trigger data refresh if callback provided
      setNeedProcessing(false);
      if (onDataRefresh) {
        onDataRefresh();
      }

    } catch (error) {
      console.error('Failed to process substrate condition:', error);
      toast({
        title: 'Processing Failed',
        description: error.message || 'Could not process imported data.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Only show when missing processed data
  if (!needProcessing) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="text-sm text-orange-800">Debug: Data Processing</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-orange-700 mb-3">
          This substrate condition may be missing processed spectral data. 
          Click to process the imported tints data.
        </p>
        <Button 
          onClick={handleProcessData}
          disabled={isProcessing}
          variant="outline"
          size="sm"
          className="border-orange-300 text-orange-800 hover:bg-orange-100"
        >
          {isProcessing ? 'Processing...' : 'Process Data'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SubstrateConditionDebugPanel;