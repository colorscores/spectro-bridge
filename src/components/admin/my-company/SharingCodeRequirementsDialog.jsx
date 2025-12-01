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

const SharingCodeRequirementsDialog = ({ 
  open, 
  onOpenChange, 
  onProceed 
}) => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [hasLocations, setHasLocations] = useState(false);
  const [locationCount, setLocationCount] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if locations exist
  useEffect(() => {
    const checkLocations = async () => {
      if (!open || !profile?.organization_id) return;
      
      setLoading(true);
      try {
        const { data: locations, error } = await supabase
          .from('organization_locations')
          .select('id')
          .eq('organization_id', profile.organization_id);
        
        if (error) throw error;
        
        const count = locations?.length || 0;
        setLocationCount(count);
        setHasLocations(count > 0);
      } catch (error) {
        console.error('Error checking locations:', error);
        toast({
          title: "Error",
          description: "Failed to check location requirements.",
          variant: "destructive",
        });
        setHasLocations(false);
      } finally {
        setLoading(false);
      }
    };

    checkLocations();
  }, [open, profile?.organization_id]);

  const handleGoThere = () => {
    onOpenChange(false);
    navigate('/admin/dashboard?tab=my-company');
  };

  const handleProceed = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideSharingCodeRequirementsDialog', 'true');
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
          <DialogTitle>Sharing Code Requirements</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Before creating a sharing code, ensure you have the following set up:
          </p>

          <div className="space-y-3">
            <RequirementItem
              title="Locations"
              isValid={hasLocations}
              description={
                hasLocations 
                  ? `You have ${locationCount} location${locationCount !== 1 ? 's' : ''} configured. Sharing codes are tied to specific locations.`
                  : <><strong>Locations</strong> represent your company's physical sites. You must create at least one location before generating a sharing code.</>
              }
              linkText="Manage Locations"
              onGoThere={handleGoThere}
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
                disabled={!hasLocations}
                className={!hasLocations ? 'opacity-50 cursor-not-allowed' : ''}
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

export default SharingCodeRequirementsDialog;
