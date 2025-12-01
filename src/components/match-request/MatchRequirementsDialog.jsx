import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, X, ExternalLink } from 'lucide-react';
import { useProfile } from '@/context/ProfileContext';

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const RequirementItem = ({ title, isValid, description, linkText, onGoThere }) => (
  <div className="space-y-2 p-4 border border-border rounded-lg">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
          isValid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        }`}>
          {isValid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </div>
        <h3 className="font-medium text-foreground">{title}</h3>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onGoThere}
        className="flex items-center gap-1 text-xs"
      >
        {linkText}
        <ExternalLink className="w-3 h-3" />
      </Button>
    </div>
    <p className="text-sm text-muted-foreground ml-9">
      {description}
    </p>
  </div>
);

const MatchRequirementsDialog = ({ 
  open, 
  onOpenChange, 
  onProceed, 
  selectedColors = [] 
}) => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [partners, setPartners] = useState([]);
  
  // Load partners only when dialog is open to avoid unnecessary hooks
  useEffect(() => {
    let active = true;
    const loadPartners = async () => {
      try {
        if (!open || !profile?.organization_id) {
          if (active) setPartners([]);
          return;
        }
        const { data, error } = await supabase.rpc('get_partners_for_org', {
          p_org_id: profile.organization_id,
        });
        if (!active) return;
        if (error) throw error;
        setPartners(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('MatchRequirementsDialog: partner fetch failed', e);
        if (active) setPartners([]);
      }
    };
    loadPartners();
    return () => { active = false; };
  }, [open, profile?.organization_id]);
  
  const [requirements, setRequirements] = useState({
    partners: false,
    qualitySets: false,
    printConditions: false
  });
  
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check requirements on mount and when data changes
  useEffect(() => {
    const checkRequirements = async () => {
      if (!profile?.organization_id) return;
      
      setLoading(true);
      
      try {
        // Check partners with collect_color_matches enabled
        const validPartners = partners.filter(p => 
          p.status === 'connected' && p.collect_color_matches === true
        );
        
        // Check quality sets
        const { data: qualitySets } = await supabase
          .from('quality_sets')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .limit(1);
        
        // Check print conditions
        const { data: printConditions } = await supabase
          .from('print_conditions')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .limit(1);
        
        setRequirements({
          partners: validPartners.length > 0,
          qualitySets: (qualitySets?.length || 0) > 0,
          printConditions: (printConditions?.length || 0) > 0
        });
      } catch (error) {
        console.error('Error checking requirements:', error);
        toast({
          title: "Error",
          description: "Failed to check match requirements.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (open && profile?.organization_id) {
      checkRequirements();
    }
  }, [open, profile?.organization_id, partners]);

  const allRequiredMet = requirements.partners && requirements.qualitySets && requirements.printConditions;

  const handleGoThere = (route) => {
    onOpenChange(false);
    navigate(route);
  };

  const handleProceed = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideMatchRequirementsDialog', 'true');
    }
    onOpenChange(false);
    onProceed();
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checking Requirements...</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Match Request Requirements</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Before creating a match request, ensure you have the following set up:
          </p>

          <div className="space-y-3">
            <RequirementItem
              title="Partners"
              isValid={requirements.partners}
              description={<><strong>Partners</strong> are print or ink supplier companies that you can collect color matches from. Make sure to enable "Collect color matches" in the partner configuration.</>}
              linkText="Manage Partners"
              onGoThere={() => handleGoThere('/admin/partners')}
            />

            <RequirementItem
              title="Quality Sets"
              isValid={requirements.qualitySets}
              description={<><strong>Quality sets</strong> define measurement standards and tolerances that ensure consistent color evaluation across your matching process.</>}
              linkText="Manage Quality Sets"
              onGoThere={() => handleGoThere('/quality-sets')}
            />

            <RequirementItem
              title="Print Conditions"
              isValid={requirements.printConditions}
              description={<><strong>Print conditions</strong> specify the substrate, ink, and printing parameters used to reproduce your colors accurately.</>}
              linkText="Manage Print Conditions"
              onGoThere={() => handleGoThere('/print-conditions')}
            />

          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dontShowAgain"
                checked={dontShowAgain}
                onCheckedChange={setDontShowAgain}
              />
              <label
                htmlFor="dontShowAgain"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Don't show this message again
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleProceed}
                disabled={!allRequiredMet}
                className={!allRequiredMet ? 'opacity-50 cursor-not-allowed' : ''}
              >
                Proceed
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchRequirementsDialog;