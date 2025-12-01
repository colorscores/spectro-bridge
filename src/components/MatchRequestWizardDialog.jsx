import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { useColorSharing } from '@/hooks/useColorSharing';

import Step1ColorDetails from './match-request-wizard/Step1ColorDetails';
import Step2PrinterDetails from './match-request-wizard/Step2PrinterDetails';
import Step3JobDetails from './match-request-wizard/Step3JobDetails';
import Stepper from './match-request-wizard/Stepper';
import { validateColorQualitySetCompatibility, COMPATIBILITY_STATUS } from '@/lib/colorQualitySetCompatibility';

const MatchRequestWizardDialog = ({ isOpen, onClose, selectedColors = [] }) => {
  const [partners, setPartners] = useState([]);
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partnerLocations, setPartnerLocations] = useState({});
  const { validateColorsSharedWithPartner } = useColorSharing();
  const [showAllPartners, setShowAllPartners] = useState(false);
  const [partnerAccessMap, setPartnerAccessMap] = useState({});
  const [isValidatingPartners, setIsValidatingPartners] = useState(false);
  
  // Load partners only when wizard is open to avoid unnecessary hooks
  useEffect(() => {
    let active = true;
    const loadPartners = async () => {
      try {
        if (!isOpen || !profile?.organization_id) {
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
        console.error('MatchRequestWizardDialog: partner fetch failed', e);
        if (active) setPartners([]);
      }
    };
    loadPartners();
    return () => { active = false; };
  }, [isOpen, profile?.organization_id]);
  
  // Form data matching step component expectations
  const [formData, setFormData] = useState({
    qualitySetMode: 'all',
    allColorsQualitySet: '',
    individualQualitySets: {},
    partnerOrgId: '',
    partnerLocationId: '',
    printConditionId: '',
    dueDate: '',
    projectId: '',
  });
  
  const [qualitySets, setQualitySets] = useState([]);
  const [printConditions, setPrintConditions] = useState([]);
  const [colorsWithMeasurements, setColorsWithMeasurements] = useState({});
  const [inkConditionsData, setInkConditionsData] = useState({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setFormData({
        qualitySetMode: 'all',
        allColorsQualitySet: '',
        individualQualitySets: {},
        partnerOrgId: '',
        partnerLocationId: '',
        printConditionId: '',
        dueDate: '',
        projectId: '',
      });
    }
  }, [isOpen]);

  // Load Quality Sets, Print Conditions, and Color Measurements for the org
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!profile?.organization_id || !isOpen) return;
      try {
        const [qsRes, pcRes] = await Promise.all([
          supabase.from('quality_sets')
            .select(`
              id, name, updated_at, measurement_settings,
              rules:quality_rules(id, name, reference)
            `)
            .eq('organization_id', profile.organization_id)
            .order('name', { ascending: true }),
          supabase.from('print_conditions')
            .select('id, name')
            .eq('organization_id', profile.organization_id)
            .order('name', { ascending: true })
        ]);
        if (!active) return;
        if (qsRes.error) throw qsRes.error;
        if (pcRes.error) throw pcRes.error;
        setQualitySets(qsRes.data || []);
        setPrintConditions(pcRes.data || []);
      } catch (err) {
        console.error('Failed to load wizard data:', err);
        toast({ title: 'Load error', description: err.message || String(err), variant: 'destructive' });
        setQualitySets([]);
        setPrintConditions([]);
      }
    };
    load();
    return () => { active = false; };
  }, [profile?.organization_id, isOpen]);

  // Load color measurements and ink condition data for selected colors
  useEffect(() => {
    let active = true;
    const loadColorData = async () => {
      if (!selectedColors || selectedColors.length === 0 || !isOpen) {
        setColorsWithMeasurements({});
        setInkConditionsData({});
        return;
      }

      try {
        const colorIds = selectedColors.map(c => c.id);
        
        // Load color measurements
        const { data: measurements, error: measurementsError } = await supabase
          .from('color_measurements')
          .select('color_id, mode, spectral_data, lab')
          .in('color_id', colorIds);

        if (measurementsError) throw measurementsError;

        // Load ink condition data for colors that have from_ink_condition_id
        const inkBasedColors = selectedColors.filter(c => c.from_ink_condition_id);
        let inkConditions = [];
        
        if (inkBasedColors.length > 0) {
          const inkConditionIds = inkBasedColors.map(c => c.from_ink_condition_id);
          const { data: inkConditionsResponse, error: inkConditionsError } = await supabase
            .from('ink_conditions')
            .select('id, spectral_data, measurement_settings')
            .in('id', inkConditionIds);

          if (inkConditionsError) throw inkConditionsError;
          inkConditions = inkConditionsResponse || [];
        }

        if (!active) return;

        // Group measurements by color_id
        const measurementsByColor = {};
        measurements?.forEach(measurement => {
          if (!measurementsByColor[measurement.color_id]) {
            measurementsByColor[measurement.color_id] = [];
          }
          measurementsByColor[measurement.color_id].push(measurement);
        });

        // Group ink conditions by color that uses them
        const inkConditionsByColor = {};
        inkBasedColors.forEach(color => {
          const inkCondition = inkConditions.find(ic => ic.id === color.from_ink_condition_id);
          if (inkCondition) {
            inkConditionsByColor[color.id] = inkCondition;
          }
        });

        setColorsWithMeasurements(measurementsByColor);
        setInkConditionsData(inkConditionsByColor);
      } catch (err) {
        console.error('Failed to load color data:', err);
        setColorsWithMeasurements({});
        setInkConditionsData({});
      }
    };

    loadColorData();
    return () => { active = false; };
  }, [selectedColors, isOpen]);

  // Validate partner access to selected colors
  useEffect(() => {
    let active = true;
    const validateAllPartners = async () => {
      if (!selectedColors.length || !partners.length || !profile?.organization_id || !isOpen) {
        if (active) setPartnerAccessMap({});
        return;
      }

      if (active) setIsValidatingPartners(true);
      const colorIds = selectedColors.map(c => c.id);
      const accessMap = {};

      // Validate each partner in parallel
      await Promise.all(
        partners
          .filter(p => p.collect_color_matches === true)
          .map(async (partner) => {
            try {
              const result = await validateColorsSharedWithPartner(
                colorIds,
                partner.id,
                profile.organization_id
              );
              accessMap[partner.id] = {
                all_shared: result?.all_shared || false,
                shared_count: result?.shared_count || 0,
                unshared_count: result?.unshared_count || colorIds.length
              };
            } catch (err) {
              console.error(`Failed to validate partner ${partner.id}:`, err);
              accessMap[partner.id] = {
                all_shared: false,
                shared_count: 0,
                unshared_count: colorIds.length
              };
            }
          })
      );

      if (active) {
        setPartnerAccessMap(accessMap);
        setIsValidatingPartners(false);
      }
    };

    validateAllPartners();
    return () => { active = false; };
  }, [selectedColors, partners, profile?.organization_id, isOpen, validateColorsSharedWithPartner]);

  // Get partner organizations for dropdown - filter based on color access
  const partnerOrgOptions = partners
    .filter(partner => {
      // Must have collect_color_matches enabled
      if (!partner.collect_color_matches) return false;
      
      // If showing all partners, include everyone
      if (showAllPartners) return true;
      
      // Otherwise, only show partners with access to ALL colors
      const access = partnerAccessMap[partner.id];
      return access?.all_shared === true;
    })
    .map(partner => ({
      value: String(partner.partner_organization_id),
      label: partner.partner_name,
      partnerId: partner.id
    }));

  // Calculate if selected partner has full access
  const selectedPartner = partners.find(p => 
    String(p.partner_organization_id) === String(formData.partnerOrgId)
  );
  const selectedPartnerAccess = selectedPartner 
    ? partnerAccessMap[selectedPartner.id] 
    : null;
  const hasPartialAccess = selectedPartnerAccess && !selectedPartnerAccess.all_shared;

  // Get partner locations - only show locations that have active partner relationships and collect matches enabled
  const getPartnerLocations = useCallback((orgId) => {
    if (!orgId) return [];
    
    // Get all partner records for this organization that are connected and have collect_color_matches enabled
    const orgPartners = partners.filter(p => 
      String(p.partner_organization_id) === String(orgId) && 
      p.status === 'connected' &&
      p.partner_location &&
      p.collect_color_matches === true
    );
    
    // Create unique locations from partner records
    const uniqueLocations = orgPartners.reduce((acc, partner) => {
      const locationKey = partner.partner_location;
      if (!acc.find(loc => loc.id === locationKey)) {
        acc.push({
          id: locationKey,
          name: partner.partner_location,
          partner_id: partner.id
        });
      }
      return acc;
    }, []);
    
    return uniqueLocations;
  }, [partners]);

  // Fetch and cache locations for selected organization
  const fetchLocationsForOrg = useCallback(async (orgId) => {
    if (!orgId || partnerLocations[String(orgId)]) return;
    
    const locations = getPartnerLocations(orgId);
    
    setPartnerLocations(prev => ({
      ...prev,
      [String(orgId)]: locations
    }));
    
    // Auto-select if only one location available
    if (locations.length === 1) {
      setFormData(prev => ({ 
        ...prev, 
        partnerLocationId: String(locations[0].id) 
      }));
    }
  }, [partnerLocations, getPartnerLocations, setFormData]);

  // Get locations for selected organization
  const getLocationsForOrg = useCallback((orgId) => {
    const locations = partnerLocations[String(orgId)] || [];
    return locations.map(location => ({
      value: String(location.id),
      label: location.name
    }));
  }, [partnerLocations]);

  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const canProceedFromStep = useCallback(() => {
    switch (currentStep) {
      case 1: {
        // Basic validation
        const hasColors = selectedColors.length > 0;
        const hasQualitySet = formData.qualitySetMode === 'separate' || 
          (formData.qualitySetMode === 'all' && formData.allColorsQualitySet);
        
        if (!hasColors || !hasQualitySet) return false;
        
        // Check for incompatible colors (red status) - block progression
        const hasIncompatibleColors = selectedColors.some(color => {
          const qualitySetId = formData.qualitySetMode === 'all' 
            ? formData.allColorsQualitySet 
            : formData.individualQualitySets[color.id];
          
          if (!qualitySetId) return false;
          
          const qualitySet = qualitySets.find(qs => qs.id === qualitySetId);
          const colorMeasurements = colorsWithMeasurements[color.id] || [];
          
          if (!qualitySet) return false;
          
          const inkConditionData = inkConditionsData[color.id];
          const compatibility = validateColorQualitySetCompatibility(color, colorMeasurements, qualitySet, inkConditionData);
          
          return compatibility?.status === COMPATIBILITY_STATUS.INCOMPATIBLE;
        });
        
        return !hasIncompatibleColors;
      }
      case 2: {
        const hasPartnerDetails = formData.partnerOrgId && formData.partnerLocationId && formData.printConditionId;
        const partnerHasFullAccess = !hasPartialAccess;
        return hasPartnerDetails && partnerHasFullAccess && !isValidatingPartners;
      }
      case 3:
        return formData.dueDate;
      default:
        return false;
    }
  }, [currentStep, selectedColors, formData, qualitySets, colorsWithMeasurements, inkConditionsData]);

  const handleSubmit = useCallback(async () => {
    if (!profile?.organization_id || !formData.partnerOrgId) {
      console.error('❌ Submit validation failed:', { 
        hasProfile: !!profile,
        orgId: profile?.organization_id,
        partnerOrgId: formData.partnerOrgId,
        colorsSelected: selectedColors.length 
      });
      toast({
        title: 'Error',
        description: 'Missing organization information',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    console.log('🚀 Starting match request creation...', {
      formData,
      selectedColorsCount: selectedColors.length,
      profileOrgId: profile.organization_id,
      partnerOrgOptions: partnerOrgOptions.map(p => ({ value: p.value, label: p.label }))
    });

    try {
      // Fix #4: Pre-submit JWT verification
      const { data: { user: jwtUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !jwtUser) {
        console.error('🚨 No valid JWT user found:', userError);
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Please log in again to create a match request."
        });
        setIsSubmitting(false);
        navigate('/login');
        return;
      }

      if (jwtUser.id !== profile.id) {
        console.error('🚨 JWT/Profile mismatch detected!', {
          jwtUserId: jwtUser.id,
          jwtEmail: jwtUser.email,
          profileUserId: profile.id,
          profileOrgId: profile.organization_id
        });
        
        toast({
          variant: "destructive",
          title: "Session Mismatch",
          description: "Your session is out of sync. Please log out and log in again."
        });
        
        // Force global sign out to clear stale tokens
        await supabase.auth.signOut({ scope: 'global' });
        setIsSubmitting(false);
        navigate('/login');
        return;
      }

      console.log('✅ Session verified: JWT user matches profile', {
        userId: jwtUser.id,
        email: jwtUser.email,
        profileOrgId: profile.organization_id
      });
      const selectedPartner = partnerOrgOptions.find(p => p.value === formData.partnerOrgId);
      
      // Get print condition name
      const selectedPrintCondition = printConditions.find(pc => pc.id === formData.printConditionId);
      
      // Get location name from cached partner locations
      const orgLocations = partnerLocations[String(formData.partnerOrgId)] || [];
      const selectedLocation = orgLocations.find(loc => String(loc.id) === String(formData.partnerLocationId));
      
      console.log('📋 Match request data prep:', {
        selectedPartner: selectedPartner?.label,
        selectedPrintCondition: selectedPrintCondition?.name,
        selectedLocation: selectedLocation?.name,
        orgLocationsCount: orgLocations.length,
        formData
      });

      // Fetch a user from the partner organization
      const { data: partnerUser, error: partnerUserError } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', formData.partnerOrgId)
        .limit(1)
        .single();
      
      if (partnerUserError || !partnerUser) {
        console.warn('⚠️ Could not find user for partner org:', formData.partnerOrgId, partnerUserError);
      }

      // Create the match request payload
      const matchRequestPayload = {
        organization_id: profile.organization_id,
        created_by: jwtUser.id,
        shared_with_org_id: formData.partnerOrgId,
        shared_with_user_id: partnerUser?.id || jwtUser.id,
        shared_with: selectedPartner?.label,
        location: selectedLocation?.name || formData.partnerLocationId,
        print_condition: selectedPrintCondition?.name || formData.printConditionId,
        project_id: formData.projectId,
        due_date: formData.dueDate,
        date_shared: new Date().toISOString().split('T')[0],
        status: 'New',
      };

      console.log('📤 Creating match request with payload:', {
        payload: matchRequestPayload,
        payloadKeys: Object.keys(matchRequestPayload),
        payloadValues: Object.entries(matchRequestPayload).map(([key, value]) => ({ [key]: typeof value === 'string' ? value : String(value) }))
      });

      // Create the match request
      const { data: matchRequest, error: matchRequestError } = await supabase
        .from('match_requests')
        .insert(matchRequestPayload)
        .select()
        .single();

      if (matchRequestError) {
        console.error('❌ Match request creation failed:', {
          error: matchRequestError,
          payload: matchRequestPayload,
          code: matchRequestError.code,
          message: matchRequestError.message,
          details: matchRequestError.details,
          hint: matchRequestError.hint,
          statusCode: matchRequestError.statusCode
        });
        throw matchRequestError;
      }

      console.log('✅ Match request created successfully:', matchRequest);

      // Create match measurements for selected colors
      const matchMeasurements = selectedColors.map(color => {
        // Determine quality set ID for this color
        let qualitySetId = null;
        if (formData.qualitySetMode === 'all' && formData.allColorsQualitySet) {
          qualitySetId = formData.allColorsQualitySet;
        } else if (formData.qualitySetMode === 'separate' && formData.individualQualitySets[color.id]) {
          qualitySetId = formData.individualQualitySets[color.id];
        }

        return {
          match_request_id: matchRequest.id,
          color_id: color.id,
          quality_set_id: qualitySetId,
          reference_lab_l: color.lab_l,
          reference_lab_a: color.lab_a,
          reference_lab_b: color.lab_b,
          status: 'New',
        };
      });

      console.log('📤 Creating match measurements:', {
        count: matchMeasurements.length,
        measurements: matchMeasurements.map(m => ({
          match_request_id: m.match_request_id,
          color_id: m.color_id,
          quality_set_id: m.quality_set_id,
          status: m.status,
          hasLabL: m.reference_lab_l !== null,
          hasLabA: m.reference_lab_a !== null,
          hasLabB: m.reference_lab_b !== null
        }))
      });

      const { error: measurementsError } = await supabase
        .from('match_measurements')
        .insert(matchMeasurements);

      if (measurementsError) {
        console.error('❌ Match measurements creation failed:', {
          error: measurementsError,
          measurements: matchMeasurements,
          code: measurementsError.code,
          message: measurementsError.message,
          details: measurementsError.details,
          hint: measurementsError.hint,
          statusCode: measurementsError.statusCode
        });
        throw measurementsError;
      }

      console.log('✅ Match measurements created successfully');

      toast({
        title: 'Match Request Created',
        description: `Your match request has been shared with ${selectedPartner?.label}`,
      });

      onClose();
      navigate('/color-matches');
    } catch (error) {
      console.error('❌ Complete match request creation failed:', {
        error,
        errorString: String(error),
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack?.slice(0, 500) // Limit stack trace length
      });
      
      // Enhanced error message with more specific details
      let errorMessage = 'Failed to create match request';
      if (error?.message?.includes('violates row-level security policy')) {
        errorMessage = 'Permission denied - unable to create match request for selected partner';
      } else if (error?.message?.includes('foreign key')) {
        errorMessage = 'Invalid data reference - please check your selections and try again';
      } else if (error?.message?.includes('not-null') || error?.message?.includes('null value')) {
        errorMessage = 'Missing required information - please complete all fields';
      } else if (error?.message?.includes('duplicate key')) {
        errorMessage = 'Duplicate match request - this request may already exist';
      } else if (error?.message) {
        errorMessage = `Creation failed: ${error.message}`;
      } else if (error?.hint) {
        errorMessage = `Creation failed: ${error.hint}`;
      } else if (error?.details) {
        errorMessage = `Creation failed: ${error.details}`;
      }

      toast({
        title: 'Match Request Creation Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [profile, selectedColors, formData, partnerOrgOptions, printConditions, partnerLocations, onClose]);

  const pageVariants = {
    initial: { opacity: 0, x: 50 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -50 },
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.4,
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1ColorDetails
            formData={formData}
            setFormData={setFormData}
            selectedColors={selectedColors}
            qualitySets={qualitySets}
            colorsWithMeasurements={colorsWithMeasurements}
            inkConditionsData={inkConditionsData}
          />
        );
      case 2:
        return (
          <Step2PrinterDetails
            formData={formData}
            setFormData={setFormData}
            partnerOrgOptions={partnerOrgOptions}
            getLocationsForOrg={getLocationsForOrg}
            printConditions={printConditions}
            fetchLocationsForOrg={fetchLocationsForOrg}
            showAllPartners={showAllPartners}
            setShowAllPartners={setShowAllPartners}
            hasPartialAccess={hasPartialAccess}
            selectedPartnerAccess={selectedPartnerAccess}
            isValidatingPartners={isValidatingPartners}
          />
        );
      case 3:
        return (
          <Step3JobDetails
            formData={formData}
            setFormData={setFormData}
            selectedColors={selectedColors}
            qualitySets={qualitySets}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Match Request</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex justify-center">
            <Stepper currentStep={currentStep} />
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="min-h-[400px]"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between pt-6 border-t">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {currentStep > 1 && (
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                  Back
                </Button>
              )}
            </div>
            {currentStep < 3 ? (
              <Button onClick={handleNext} disabled={!canProceedFromStep()}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceedFromStep() || isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Match Request'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchRequestWizardDialog;
