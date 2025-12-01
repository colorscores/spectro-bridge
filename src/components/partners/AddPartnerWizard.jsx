import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import WizardStepper from './WizardStepper';
import Step1PartnerInfo from './wizard/Step1PartnerInfo';
import Step2RoleOptions from './wizard/Step2RoleOptions';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';

const AddPartnerWizard = ({ open, onOpenChange, onInvite, children, mode = 'add', editPartner = null }) => {
  const { profile } = useProfile();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    sharingCode: '',
    verifiedOrg: null,
    verifiedLocation: null,
    selectedOrgRoles: [],
    sharingOption: 'all',
    selectedTags: [],
    collectColorMatches: false,
    autoRequestAnalogDrawdowns: false,
    forceDirectMeasurement: false,
    shareCreatePackLicenses: false,
    createPackLicenseCount: 0,
    allowDownload: true,
  });

  // Dynamic step configuration based on partner roles
  const steps = React.useMemo(() => {
    const isInkSupplierOnly = Array.isArray(formData.selectedOrgRoles) && 
      formData.selectedOrgRoles.length === 1 && 
      formData.selectedOrgRoles[0] === 'Ink Supplier';
    
    // For printer organizations connecting to ink suppliers, skip role options (no sharing needed)
    const isPrinterToInkSupplier = profile?.organization?.type?.includes('Print Supplier') && isInkSupplierOnly;
      
    if (isPrinterToInkSupplier || isInkSupplierOnly) {
      return [{ id: 1, name: 'Partner Details' }];
    }
    
    return [
      { id: 1, name: 'Partner Details' },
      { id: 2, name: 'Role Options' },
    ];
  }, [formData.selectedOrgRoles, profile?.organization?.type]);

  const handleNext = () => setCurrentStep((prev) => Math.min(prev + 1, steps.length));
  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const updateFormData = (data) => {
    setFormData((prev) => {
      const newData = { ...prev, ...data };
      
      // If switching to ink supplier only, set appropriate defaults
      if (data.selectedOrgRoles && Array.isArray(data.selectedOrgRoles)) {
        const isInkSupplierOnly = data.selectedOrgRoles.length === 1 && data.selectedOrgRoles[0] === 'Ink Supplier';
        const isPrinterToInkSupplier = profile?.organization?.type?.includes('Print Supplier') && isInkSupplierOnly;
        
        if (isPrinterToInkSupplier) {
          newData.sharingOption = 'none'; // No color sharing for printer-to-ink-supplier
          newData.selectedTags = [];
          newData.collectColorMatches = false; // No match collection for this connection type
        }
      }
      
      return newData;
    });
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      sharingCode: '',
      verifiedOrg: null,
      verifiedLocation: null,
      selectedOrgRoles: [],
      sharingOption: 'all',
      selectedTags: [],
      collectColorMatches: false,
      autoRequestAnalogDrawdowns: false,
      forceDirectMeasurement: false,
      shareCreatePackLicenses: false,
      createPackLicenseCount: 0,
      allowDownload: true,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  // Prefill data when editing an existing partner
  useEffect(() => {
    const loadEditDefaults = async () => {
      if (!open || mode !== 'edit' || !editPartner) return;
      try {
        const { data: settings, error: settingsError } = await supabase
          .from('partners')
          .select('partner_roles, collect_color_matches, auto_request_analog_drawdowns, force_direct_measurement, share_create_pack_licenses, create_pack_license_count, allow_download')
          .eq('id', editPartner.id)
          .single();
        if (settingsError) throw settingsError;

        const { data: tagRows, error: tagsError } = await supabase
          .from('tag_associations')
          .select('tag_id')
          .eq('partner_id', editPartner.id);
        if (tagsError) throw tagsError;

        const preselectedTags = (tagRows || []).map((t) => t.tag_id);

        setFormData((prev) => ({
          ...prev,
          sharingCode: '',
          verifiedOrg: {
            id: editPartner.partner_organization_id,
            name: editPartner.partner_name,
            type: editPartner.partner_type || [],
          },
          verifiedLocation: { name: editPartner.partner_location },
          selectedOrgRoles: settings?.partner_roles || [],
          sharingOption: preselectedTags.length > 0 ? 'tags' : 'all',
          selectedTags: preselectedTags,
          collectColorMatches: !!settings?.collect_color_matches,
          autoRequestAnalogDrawdowns: !!settings?.auto_request_analog_drawdowns,
          forceDirectMeasurement: !!settings?.force_direct_measurement,
          shareCreatePackLicenses: !!settings?.share_create_pack_licenses,
          createPackLicenseCount: settings?.create_pack_license_count || 0,
          allowDownload: settings?.allow_download !== false,
        }));
      } catch (e) {
        console.error('Failed to load partner settings for edit:', e);
      }
    };
    loadEditDefaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, editPartner]);

  const handleSendInvitation = async () => {
    if (!profile?.organization_id || !formData.verifiedOrg?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Missing organization information.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'edit' && editPartner?.id) {
        // Update partner configuration
        const { error: updateError } = await supabase.rpc('update_partner_settings', {
          p_partner_id: editPartner.id,
          p_partner_roles: formData.selectedOrgRoles,
          p_collect_color_matches: formData.collectColorMatches,
          p_auto_request_analog_drawdowns: formData.autoRequestAnalogDrawdowns,
          p_force_direct_measurement: formData.forceDirectMeasurement,
          p_share_create_pack_licenses: formData.shareCreatePackLicenses,
          p_create_pack_license_count: formData.createPackLicenseCount,
          p_allow_download: formData.allowDownload !== false,
        });
        if (updateError) throw updateError;

        // Update sharing tags
        const tagsToSet = formData.sharingOption === 'tags' ? formData.selectedTags : [];
        const { error: tagsError } = await supabase.rpc('update_partner_tags', {
          p_partner_id: editPartner.id,
          p_tag_ids: tagsToSet,
          p_organization_id: profile.organization_id,
        });
        if (tagsError) throw tagsError;

        toast({ title: 'Partner updated', description: `${formData.verifiedOrg.name} settings saved.` });
        onInvite?.();
        handleClose();
      } else {
        // Create invitation with config
        const { error } = await supabase.rpc('create_partner_invitation', {
          p_inviting_org_id: profile.organization_id,
          p_partner_org_id: formData.verifiedOrg.id,
          p_partner_org_location: formData.verifiedLocation?.name || null,
          p_tags: formData.sharingOption === 'tags' ? formData.selectedTags : [],
          p_partner_roles: formData.selectedOrgRoles,
          p_collect_color_matches: formData.collectColorMatches,
          p_auto_request_analog_drawdowns: formData.autoRequestAnalogDrawdowns,
          p_force_direct_measurement: formData.forceDirectMeasurement,
          p_share_create_pack_licenses: formData.shareCreatePackLicenses,
          p_create_pack_license_count: formData.createPackLicenseCount,
          p_allow_download: formData.allowDownload !== false,
        });
        if (error) throw error;

        toast({
          title: 'Invitation Sent!',
          description: `Your invitation to ${formData.verifiedOrg.name} has been sent.`,
        });
        onInvite?.();
        handleClose();
      }
    } catch (error) {
      console.error('Partner invitation/update failed:', error);
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 1) {
      return !formData.verifiedOrg || !(Array.isArray(formData.selectedOrgRoles) && formData.selectedOrgRoles.length > 0);
    }
    if (currentStep === 2) {
        if(formData.sharingOption === 'tags' && formData.selectedTags.length === 0) {
            return true;
        }
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {children}
      <DialogContent className="sm:max-w-[650px] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl text-center font-bold">{mode === 'edit' ? 'Edit Partner' : 'Invite New Partner'}</DialogTitle>
          <DialogDescription className="text-center">
            {mode === 'edit' ? 'Update roles, options, and sharing tags for this partner.' : 'Follow the steps to connect with a new partner organization.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6">
          <WizardStepper steps={steps} currentStep={currentStep} />
        </div>

        <div className="p-6 pt-0 min-h-[300px]">
          {currentStep === 1 && <Step1PartnerInfo mode={mode} data={formData} updateData={updateFormData} userOrganizationId={profile?.organization_id} />}
          {currentStep === 2 && <Step2RoleOptions data={formData} updateData={updateFormData} />}
        </div>

        <DialogFooter className="p-6 bg-gray-50 border-t">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {currentStep > 1 && <Button variant="outline" onClick={handleBack}>Back</Button>}
          {currentStep < steps.length ? (
            <Button onClick={handleNext} disabled={isNextDisabled()}>Continue</Button>
          ) : (
            <Button onClick={handleSendInvitation} disabled={isSubmitting || isNextDisabled()}>
              {isSubmitting ? (mode === 'edit' ? 'Saving...' : 'Sending...') : (mode === 'edit' ? 'Save Changes' : 'Send Invitation')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddPartnerWizard;