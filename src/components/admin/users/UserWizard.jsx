import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Step1BasicInfo from './wizard/Step1BasicInfo';
import Step2SharingTags from './wizard/Step2SharingTags';
import Step3Summary from './wizard/Step3Summary';
import WizardStepper from './wizard/WizardStepper';
import { useProfile } from '@/context/ProfileContext';
import { useMyCompanyLogic } from '@/components/admin/my-company/hooks/useMyCompanyLogic';
import { supabase } from '@/lib/customSupabaseClient';
import Step2BrandAccess from './wizard/Step2BrandAccess';
import { fetchSingleAuthEmail } from '@/lib/authEmailHelper';

const UserWizard = ({ user, onComplete, startOnStep = 1 }) => {
  const { profile } = useProfile();
  const { organization, categories, tags, locations, loading: dataLoading } = useMyCompanyLogic();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(startOnStep);
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [orgTags, setOrgTags] = useState([]);
  const [orgCategories, setOrgCategories] = useState([]);
  const [selectedOrgType, setSelectedOrgType] = useState([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  // Track latest taxonomy request so stale responses cannot override current data
  const taxonomyReqRef = useRef('');
  const prevOrgIdRef = useRef((user ? (user?.organization_id || '') : (profile?.organization_id || '')) || null);
  const [formData, setFormData] = useState(() => {
    const fullName = user?.full_name || '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    return {
      email: user?.email || '',
      password: '',
      firstName,
      lastName,
      role: user?.role || 'Color User',
      organizationId: user ? (user?.organization_id || '') : (profile?.organization_id || ''),
      location: user?.location || '',
      allowOtherLocations: user?.allow_other_locations || false,
      limitByTags: user?.limit_by_tags || false,
      sharingTags: user?.sharing_tags?.map(t => t.tag_id) || user?.tags?.map(t => t.id) || [],
      selectedBrandIds: user?.selected_brand_partner_ids || [], // partner connection ids
      activeBrandId: user?.active_brand_partner_id || null,  // selected partner connection id for tag selection
    };
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: userData,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('User created successfully!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onComplete();
    },
    onError: (error) => {
      toast.error(`Error creating user: ${error.message}`);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData) => {
      const { data, error } = await supabase.functions.invoke('update-user-details', {
        body: { userId: user.id, ...userData },
      });
      if (error) {
        let code = '';
        let message = error?.message || 'Unknown error';
        try {
          const parsed = JSON.parse(message);
          if (parsed && typeof parsed === 'object') {
            code = parsed.code || '';
            message = parsed.error || parsed.message || message;
          }
        } catch (_) {}
        const e = new Error(code || message);
        // @ts-ignore - attach code for downstream handling
        e.code = code || undefined;
        throw e;
      }
      if (data?.error || data?.code) {
        const e = new Error(data?.error || data?.message || 'Unknown error');
        // @ts-ignore - attach code
        e.code = data?.code;
        throw e;
      }
      return data;
    },
    onSuccess: (resp) => {
      const fallbackEmail = (formData.email || '').trim() || undefined;
      const updatedEmail = resp?.updatedEmail || fallbackEmail;
      if (updatedEmail) {
        setFormData(prev => ({ ...prev, email: updatedEmail }));
      }
      toast.success('User updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onComplete({ userId: user?.id, updatedEmail });
    },
    onError: (error) => {
      const rawMsg = error?.message || '';
      // @ts-ignore
      const code = error?.code || (typeof rawMsg === 'string' && /^[A-Z0-9_]+$/.test(rawMsg) ? rawMsg : undefined);
      if (code === 'EMAIL_EXISTS' || rawMsg.includes('EMAIL_EXISTS')) {
        toast.error('That email is already in use. Please use a different email.');
      } else if (code === 'AUTH_USER_NOT_FOUND' || rawMsg.includes('AUTH_USER_NOT_FOUND')) {
        toast.error('No authentication account exists for this user. Email cannot be updated until the user signs up.');
      } else if (code === 'MISSING_SUPABASE_CONFIG' || rawMsg.includes('MISSING_SUPABASE_CONFIG')) {
        toast.error('Server is missing Supabase Service Role configuration. Please set secrets and redeploy.');
      } else {
        toast.error(`Error updating user: ${rawMsg || 'Unknown error'}`);
      }
      console.error('Update user failed:', error);
    },
  });

  // Reset when dialog opens for different user/start step
  useEffect(() => {
    setCurrentStep(startOnStep);
    const fullName = user?.full_name || '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    setFormData(prev => ({
      ...prev,
      email: user?.email || '',
      password: '',
      firstName,
      lastName,
      role: user?.role || 'Color User',
      organizationId: user ? (user?.organization_id ?? user?.organization?.id ?? '') : (profile?.organization_id ?? ''),
      location: user?.location || '',
      allowOtherLocations: user?.allow_other_locations || false,
      limitByTags: user?.limit_by_tags || false,
      sharingTags: user?.sharing_tags?.map(t => t.tag_id) || user?.tags?.map(t => t.id) || [],
      selectedBrandIds: user?.selected_brand_partner_ids || [],
      activeBrandId: user?.active_brand_partner_id || null,
    }));
  }, [user, startOnStep, profile]);

  // Load full user details on edit to get saved org and tags
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, full_name, role, organization_id, location, allow_other_locations, limit_by_tags,
          selected_brand_partner_ids, active_brand_partner_id,
          user_sharing_tags ( tag_id )
        `)
        .eq('id', user.id)
        .single();
      if (error) { console.warn('Failed to load user profile details', error); return; }
      if (!active) return;
      const fullName = data?.full_name || '';
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setFormData(prev => ({
        ...prev,
        email: data?.email ?? prev.email,
        firstName,
        lastName,
        role: data?.role ?? prev.role,
        organizationId: data?.organization_id ?? prev.organizationId,
        location: data?.location ?? prev.location,
        allowOtherLocations: data?.allow_other_locations ?? prev.allowOtherLocations,
        limitByTags: data?.limit_by_tags ?? prev.limitByTags,
        sharingTags: (data?.user_sharing_tags || []).map((t) => t.tag_id) || prev.sharingTags,
        selectedBrandIds: data?.selected_brand_partner_ids ?? prev.selectedBrandIds,
        activeBrandId: data?.active_brand_partner_id ?? prev.activeBrandId,
      }));
    })();
    return () => { active = false };
  }, [user?.id]);

  // Backfill email from server if not present in selected user (profiles table has no email)
  useEffect(() => {
    if (!user?.id) return;
    if (formData.email) return;
    let cancelled = false;
    (async () => {
      const email = await fetchSingleAuthEmail(user.id);
      if (email) {
        setFormData(prev => ({ ...prev, email }));
      }
    })();
    return () => { cancelled = true };
  }, [user?.id, formData.email]);

  // Fetch partner brands when organization changes
  useEffect(() => {
    const orgId = formData.organizationId;
    if (!orgId) {
      setPartners([]);
      return;
    }
    let active = true;
    setPartnersLoading(true);
    console.info('[UserWizard] Fetching partners for org', { orgId });
    (async () => {
      try {
        // Use RPC to bypass RLS and get both-direction partner connections for this org
        const { data: rpcRows, error: rpcError } = await supabase.rpc('get_partners_for_org', { p_org_id: orgId });
        if (rpcError) throw rpcError;

        const rows = rpcRows || [];
        console.info('[UserWizard] RPC get_partners_for_org returned', { count: rows.length });

        // Determine the "other" org ids (brand org) from the rows
        const partnerOrgIds = Array.from(new Set(rows.map(r => r.partner_organization_id)));
        let orgMap = new Map();
        if (partnerOrgIds.length > 0) {
          const { data: orgs, error: orgsError } = await supabase
            .from('organizations')
            .select('id, name, type')
            .in('id', partnerOrgIds);
          if (orgsError) throw orgsError;
          (orgs || []).forEach(o => orgMap.set(o.id, o));
        }

        // Enrich with names/types (and keep existing fields from RPC)
        const enriched = rows.map(r => ({
          ...r,
          partner_name: r.partner_name || orgMap.get(r.partner_organization_id)?.name || '',
          partner_type: r.partner_type || orgMap.get(r.partner_organization_id)?.type || [],
        }));

        console.info('[UserWizard] Partners loaded (RPC)', { count: enriched.length, orgId });
        setPartners(enriched);
      } catch (err) {
        console.error('[UserWizard] Failed to fetch partners via RPC', err);
        setPartners([]);
      } finally {
        setPartnersLoading(false);
      }
    })();

    // Clear brand selections only when organization actually changes
    if (prevOrgIdRef.current !== orgId) {
      setFormData(prev => ({ ...prev, selectedBrandIds: [], activeBrandId: null }));
      prevOrgIdRef.current = orgId;
    }
    return () => { active = false };
  }, [formData.organizationId]);

  // Fetch categories and tags for the effective organization (with partner RPC when brand selected)
  useEffect(() => {
    const activePartnerId = formData.activeBrandId;
    // Determine effective org id (for logs/local fetch only)
    let targetOrgId = formData.organizationId || null;
    if (activePartnerId) {
      const active = (partners || []).find(p => p.id === activePartnerId);
      if (active?.partner_organization_id) {
        targetOrgId = active.partner_organization_id;
      }
    }

    // Tag this request to ensure only the latest result applies
    const reqToken = `${formData.organizationId || 'noorg'}|${activePartnerId || 'nobrand'}`;
    taxonomyReqRef.current = reqToken;

    if (!formData.organizationId && !activePartnerId) {
      console.info('[UserWizard] No org or partner selected; skipping taxonomy fetch');
      // Keep existing taxonomy (avoid flicker) but clear loading indicator
      setTaxonomyLoading(false);
      return;
    }

    let cancelled = false;
    setTaxonomyLoading(true);
    console.info('[UserWizard] Loading taxonomy', { mode: activePartnerId ? 'partner' : 'org', activePartnerId, targetOrgId, reqToken });

    const fetchOrgType = async (orgId) => {
      const { data, error } = await supabase.from('organizations').select('type').eq('id', orgId).maybeSingle();
      if (!cancelled && taxonomyReqRef.current === reqToken && !error) {
        setSelectedOrgType(data?.type || []);
      }
    };

    if (activePartnerId) {
      // Clear existing taxonomy first to avoid showing wrong data
      console.info('[UserWizard] Clearing taxonomy before loading brand data', { activePartnerId });
      setOrgCategories([]);
      setOrgTags([]);
      
      // Determine which organization's taxonomy to fetch
      let taxonomyOrgId = null;
      if (activePartnerId === 'my-company') {
        // "My Company" selected - fetch user's own organization taxonomy
        taxonomyOrgId = formData.organizationId;
        console.info('[UserWizard] Loading "My Company" taxonomy', { taxonomyOrgId });
      } else {
        // Brand partner selected - fetch the brand organization's taxonomy
        const selectedPartner = partners.find(p => p.id === activePartnerId);
        taxonomyOrgId = selectedPartner?.partner_organization_id;
        console.info('[UserWizard] Loading brand taxonomy', { taxonomyOrgId, activePartnerId });
      }
      
      if (taxonomyOrgId) {
        Promise.all([
          supabase.from('categories').select('*').eq('organization_id', taxonomyOrgId).order('name'),
          supabase.from('tags').select('*, category:categories(name, parent_id)').eq('organization_id', taxonomyOrgId).order('name'),
        ])
          .then(([catRes, tagRes]) => {
            if (cancelled || taxonomyReqRef.current !== reqToken) {
              console.debug('[UserWizard] Stale brand taxonomy response ignored', { reqToken });
              return;
            }
            const cats = catRes.error ? [] : (catRes.data || []);
            const tgs = tagRes.error ? [] : (tagRes.data || []);
            console.info('[UserWizard] Brand/Company taxonomy loaded', { categories: cats.length, tags: tgs.length, taxonomyOrgId, reqToken });
            setOrgCategories(cats);
            setOrgTags(tgs);
          })
          .catch((e) => {
            if (!cancelled && taxonomyReqRef.current === reqToken) {
              console.error('[UserWizard] Brand taxonomy load failed', e);
              setOrgCategories([]);
              setOrgTags([]);
            }
          })
          .finally(() => {
            if (!cancelled && taxonomyReqRef.current === reqToken) {
              setTaxonomyLoading(false);
            }
          });
      } else {
        console.warn('[UserWizard] No taxonomy org ID found for activePartnerId', { activePartnerId });
        setTaxonomyLoading(false);
      }

      // Org type is for current user's org (controls isPartnerMode in Sharing Tags)
      if (formData.organizationId) fetchOrgType(formData.organizationId);
    } else {
      // Organization taxonomy (no partner selected)
      const orgId = formData.organizationId;
      Promise.all([
        supabase.from('categories').select('*').eq('organization_id', orgId).order('name'),
        supabase.from('tags').select('*, category:categories(name, parent_id)').eq('organization_id', orgId).order('name'),
        supabase.from('organizations').select('type').eq('id', orgId).maybeSingle(),
      ])
        .then(([catRes, tagRes, orgRes]) => {
          if (cancelled || taxonomyReqRef.current !== reqToken) {
            console.debug('[UserWizard] Stale org taxonomy response ignored', { reqToken });
            return;
          }
          const cats = catRes.error ? [] : (catRes.data || []);
          const tgs = tagRes.error ? [] : (tagRes.data || []);
          console.info('[UserWizard] Org taxonomy loaded', { categories: cats.length, tags: tgs.length, orgId, reqToken });
          setOrgCategories(cats);
          setOrgTags(tgs);
          if (!orgRes.error) {
            setSelectedOrgType(orgRes.data?.type || []);
          }
        })
        .catch((e) => {
          if (!cancelled && taxonomyReqRef.current === reqToken) {
            console.error('[UserWizard] Taxonomy load failed', e);
          }
        })
        .finally(() => {
          if (!cancelled && taxonomyReqRef.current === reqToken) {
            setTaxonomyLoading(false);
          }
        });
    }

    return () => { cancelled = true };
  }, [formData.organizationId, formData.activeBrandId, partners]);

  // Choose default active brand based on user's saved tags and available brand partners
  useEffect(() => {
    if (!formData.limitByTags) return;
    if (!partners || partners.length === 0) return;
    if (formData.activeBrandId) return;
    if (!formData.sharingTags || formData.sharingTags.length === 0) return;

    const eligiblePartners = (partners || []).filter(p =>
      Array.isArray(p.partner_type) && p.partner_type.some(t => String(t).toLowerCase() === 'brand')
    );
    if (eligiblePartners.length === 0) return;

    const partnerIds = eligiblePartners.map(p => p.id);
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('tag_associations')
        .select('partner_id, tag_id')
        .in('partner_id', partnerIds);
      if (cancelled) return;
      if (error) { console.warn('Failed to load partner tag associations', error); return; }
      const map = new Map();
      for (const row of data || []) {
        if (!map.has(row.partner_id)) map.set(row.partner_id, new Set());
        map.get(row.partner_id).add(row.tag_id);
      }
      let bestPartner = null;
      let bestCount = 0;
      for (const pid of partnerIds) {
        const allowed = map.get(pid) || new Set();
        let count = 0;
        for (const tid of formData.sharingTags) if (allowed.has(tid)) count++;
        if (count > bestCount) { bestCount = count; bestPartner = pid; }
      }
      if (bestPartner) {
        setFormData(prev => ({
          ...prev,
          selectedBrandIds: Array.from(new Set([...(prev.selectedBrandIds||[]), bestPartner])),
          activeBrandId: bestPartner
        }));
      }
    })();
    return () => { cancelled = true };
  }, [partners, formData.limitByTags, formData.sharingTags, formData.activeBrandId]);

  // Build dynamic steps
  const brandPartners = useMemo(() => {
    return (partners || []).filter(p => {
      const t = p.partner_type;
      if (Array.isArray(t)) {
        return t.some(v => String(v).toLowerCase().includes('brand'));
      }
      if (typeof t === 'string') {
        return t.toLowerCase().includes('brand');
      }
      return false;
    });
  }, [partners]);
  const orgIsBrand = useMemo(
    () => Array.isArray(selectedOrgType) && selectedOrgType.some(t => String(t).toLowerCase() === 'brand'),
    [selectedOrgType]
  );
  // Library Access step only appears when limitByTags is checked AND brand partners exist
  const hasBrandStep = useMemo(
    () => formData.limitByTags && (brandPartners && brandPartners.length > 0),
    [formData.limitByTags, brandPartners]
  );

  // Sharing Tags step only appears when limitByTags is checked
  const hasTagsStep = useMemo(
    () => formData.limitByTags,
    [formData.limitByTags]
  );

  const steps = useMemo(() => {
    const s = [
      { name: 'Basic Info', id: 1 },
    ];
    // Only add Library Access if limitByTags is checked and brand partners exist
    if (hasBrandStep) s.push({ name: 'Library Access', id: s.length + 1 });
    // Only add Sharing Tags if limitByTags is checked
    if (hasTagsStep) s.push({ name: 'Sharing Tags', id: s.length + 1 });
    s.push({ name: 'Summary', id: s.length + 1 });
    return s.map((step, idx) => ({ ...step, id: idx + 1 }));
  }, [hasBrandStep, hasTagsStep]);

  // Ensure startOnStep=2 jumps to Sharing Tags once flow is known
  useEffect(() => {
    if (startOnStep === 2) {
      setCurrentStep(hasBrandStep ? 3 : 2);
    }
  }, [startOnStep, hasBrandStep]);

  // Simple step navigation
  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = () => {
    const submissionData = {
      email: (formData.email || '').trim(),
      password: formData.password,
      fullName: `${(formData.firstName || '').trim()} ${(formData.lastName || '').trim()}`.trim(),
      role: formData.role,
      organizationId: formData.organizationId,
      location: formData.location,
      allowOtherLocations: formData.allowOtherLocations,
      limitByTags: formData.limitByTags,
      sharingTags: formData.sharingTags,
      selectedBrandIds: formData.selectedBrandIds,
      activeBrandId: formData.activeBrandId,
    };

    console.info('Submitting user update/create', { mode: user ? 'edit' : 'add', keys: Object.keys(submissionData), email: submissionData.email });

    // Visual diagnostic so you see something even if network stalls
    const loadingToastId = toast.loading(user ? 'Updating user…' : 'Creating user…');
    const stallTimer = setTimeout(() => {
      toast('Still working… checking server response');
      console.warn('Mutation seems to be stalling (>6s)');
    }, 6000);

    const clearIndicators = () => {
      clearTimeout(stallTimer);
      toast.dismiss(loadingToastId);
    };

    if (user) {
      updateUserMutation.mutate(submissionData, { onSettled: clearIndicators });
    } else {
      createUserMutation.mutate(submissionData, { onSettled: clearIndicators });
    }
  };

  const isSubmitting = createUserMutation.isPending || updateUserMutation.isPending;

  // Determine which content to render for current step
  const isBasicStep = currentStep === 1;
  const isBrandStep = hasBrandStep && currentStep === 2;
  // Tags step appears at different positions depending on whether brand step exists
  const isTagsStep = hasTagsStep && (
    (hasBrandStep && currentStep === 3) || (!hasBrandStep && currentStep === 2)
  );
  // Summary is always the last step
  const isSummaryStep = (
    (!hasBrandStep && !hasTagsStep && currentStep === 2) ||
    (!hasBrandStep && hasTagsStep && currentStep === 3) ||
    (hasBrandStep && !hasTagsStep && currentStep === 3) ||
    (hasBrandStep && hasTagsStep && currentStep === 4)
  );

  // Adjust current step if brand or tags steps appear/disappear
  useEffect(() => {
    const maxStep = 1 + (hasBrandStep ? 1 : 0) + (hasTagsStep ? 1 : 0) + 1; // Basic + optional Brand + optional Tags + Summary
    setCurrentStep(prev => Math.min(prev, maxStep));
  }, [hasBrandStep, hasTagsStep]);

  // Show loading state if org data is still loading
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading organization data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <WizardStepper steps={steps} currentStep={currentStep} />
      </div>
      <div>
        {isBasicStep && (
          <Step1BasicInfo formData={formData} setFormData={setFormData} mode={user ? 'edit' : 'add'} />
        )}
        {isBrandStep && (
          <Step2BrandAccess
            formData={formData}
            setFormData={setFormData}
            partners={brandPartners}
            loading={partnersLoading}
          />
        )}
          {isTagsStep && (
            <Step2SharingTags
              formData={formData}
              setFormData={setFormData}
              tags={orgTags || []}
              categories={orgCategories || []}
              brandPartners={brandPartners}
              orgIsBrand={orgIsBrand}
              taxonomyLoading={taxonomyLoading}
            />
          )}
        {isSummaryStep && (
          <Step3Summary formData={formData} tags={orgTags || []} categories={orgCategories || []} locations={locations || []} />
        )}
      </div>
      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={onComplete} disabled={isSubmitting}>Cancel</Button>
        <div className="flex space-x-4">
          {currentStep > 1 && <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>Back</Button>}
          {currentStep < steps.length && (
            <Button onClick={handleNext} disabled={isSubmitting}>
              Next
            </Button>
          )}
          {currentStep === steps.length && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user ? 'Update User' : 'Create User'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserWizard;
