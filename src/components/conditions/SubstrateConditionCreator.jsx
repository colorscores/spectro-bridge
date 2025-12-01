import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSubstrateConditionCreation } from '@/hooks/useSubstrateConditionCreation';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { normalizeTints, getTintPercentage } from '@/lib/tintsUtils';

const SubstrateConditionCreator = ({ 
  inkConditionId,
  parentSubstrate,
  organizationId,
  onSubstrateConditionCreated,
  shouldAutoCreate = false
}) => {
  const [hasChecked, setHasChecked] = useState(false);
  const [canCreateFromTints, setCanCreateFromTints] = useState(false);
  const { createSubstrateConditionFromImportedTints, isCreating } = useSubstrateConditionCreation();
  

  // Check if we can create a substrate condition from imported tints
  useEffect(() => {
    if (!inkConditionId || !parentSubstrate || hasChecked) return;

    // Check if ink condition has imported tints with substrate data (0% tint)
    const checkForSubstrateTints = async () => {
      try {
        const { data: inkCondition, error } = await supabase
          .from('ink_conditions')
          .select('imported_tints, substrate_condition')
          .eq('id', inkConditionId)
          .single();

        if (error) {
          console.error('Error checking ink condition:', error);
          return;
        }

        // Check if substrate_condition is missing and we have imported tints
        const normalizedTints = normalizeTints(inkCondition?.imported_tints);
        const hasSubstrateTints = normalizedTints.some(
          tint => getTintPercentage(tint) === 0 && (tint.spectral_data || tint.spectralData)
        );

        console.log('Checking for 0% tint:', {
          imported_tints: inkCondition?.imported_tints,
          normalizedTints,
          hasSubstrateTints,
          zeroPercentTints: normalizedTints.filter(tint => getTintPercentage(tint) === 0)
        });

        const needsSubstrateCondition = !inkCondition?.substrate_condition;

        setCanCreateFromTints(hasSubstrateTints && needsSubstrateCondition);
        setHasChecked(true);

        // Auto-create if requested and conditions are met
        if (shouldAutoCreate && hasSubstrateTints && needsSubstrateCondition) {
          handleCreateSubstrateCondition();
        }
      } catch (error) {
        console.error('Error checking for substrate tints:', error);
        setHasChecked(true);
      }
    };

    checkForSubstrateTints();
  }, [inkConditionId, parentSubstrate, hasChecked, shouldAutoCreate]);

  const handleCreateSubstrateCondition = async () => {
    if (!inkConditionId || !parentSubstrate?.id || !organizationId) {
      toast({
        title: "Missing Information",
        description: "Unable to create substrate condition: missing required data.",
        variant: "destructive",
      });
      return;
    }

    const substrateIdToUse = parentSubstrate.id;

    console.log('🎯 SubstrateConditionCreator substrateIdToUse:', substrateIdToUse);

    const created = await createSubstrateConditionFromImportedTints(
      inkConditionId,
      substrateIdToUse,
      organizationId
    );

    const substrateConditionId = created && typeof created === 'object' ? created.id : created;

    if (substrateConditionId && onSubstrateConditionCreated) {
      onSubstrateConditionCreated(substrateConditionId);
    }
  };
  if (!hasChecked || !canCreateFromTints) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Substrate Condition Missing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-orange-700">
          This ink condition has substrate measurement data but no linked substrate condition. 
          A substrate condition can be automatically created from the imported 0% tint measurement.
        </p>
        <Button
          onClick={handleCreateSubstrateCondition}
          disabled={isCreating}
          size="sm"
          className="w-full"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Create Substrate Condition
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SubstrateConditionCreator;