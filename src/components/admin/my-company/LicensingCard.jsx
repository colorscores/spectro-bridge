import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpCircle } from 'lucide-react';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/integrations/supabase/client';


const LicensingCard = ({ organizationId = null, organization = null, onLearn }) => {
  const { profile } = useProfile();
  const isSuperAdmin = profile?.role === 'Superadmin';
  
  
  // For organization context (when editing specific org), use the passed organization data
  // For user context (in My Company), use the user's profile organization
  const targetOrganization = organization || profile?.organization;
  const isBrandOwner = targetOrganization?.type?.includes('Brand Owner');
  
const [partners, setPartners] = useState([]);
const [licenses, setLicenses] = useState({
  libraries: { plan: 'Free', isEditing: false },
  printerKiosk: { plan: 'No', isEditing: false },
  matchPack: { plan: '1', isEditing: false },
  createPack: { plan: 'No', isEditing: false },
});

const targetOrgId = organizationId || profile?.organization_id || profile?.organization?.id;

// Load partners for usage calculations
useEffect(() => {
  let cancelled = false;
  const loadPartners = async () => {
    if (!targetOrgId) return;
    try {
      const { data } = await supabase.rpc('get_partners_for_org', { p_org_id: targetOrgId });
      if (!cancelled) setPartners(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!cancelled) setPartners([]);
    }
  };
  loadPartners();
  return () => { cancelled = true; };
}, [targetOrgId]);

// Load licenses from database
useEffect(() => {
  const loadLicenses = async () => {
    if (!targetOrgId) return;
    try {
      const { data: orgData, error } = await supabase
        .from('organizations')
        .select('color_libraries_license, printer_kiosk_license, match_pack_license, create_pack_license')
        .eq('id', targetOrgId)
        .single();
      if (error) return;
      if (orgData) {
        setLicenses({
          libraries: { plan: orgData.color_libraries_license || 'Free', isEditing: false },
          printerKiosk: { plan: orgData.printer_kiosk_license || 'No', isEditing: false },
          matchPack: { plan: orgData.match_pack_license || '1', isEditing: false },
          createPack: { plan: orgData.create_pack_license || 'No', isEditing: false },
        });
      }
    } catch (e) {
      // ignore
    }
  };
  loadLicenses();
}, [targetOrgId]);

// Update license in database and local state
const updateLicense = async (type, newPlan) => {
  if (!targetOrgId) return false;
  const columnMap = {
    libraries: 'color_libraries_license',
    printerKiosk: 'printer_kiosk_license',
    matchPack: 'match_pack_license',
    createPack: 'create_pack_license',
  };
  try {
    const { error } = await supabase
      .from('organizations')
      .update({ [columnMap[type]]: newPlan })
      .eq('id', targetOrgId);
    if (error) return false;

    setLicenses(prev => ({
      ...prev,
      [type]: { ...prev[type], plan: newPlan, isEditing: false },
    }));
    return true;
  } catch (error) {
    return false;
  }
};

// Calculate usage for different license types
const calculateUsage = (type) => {
  switch (type) {
    case 'matchPack': {
      if (!isBrandOwner) return '-';
      return (
        partners?.filter((partner) =>
          partner.collect_color_matches === true &&
          ['connected', 'accepted'].includes(partner.status) &&
          partner.partner_roles?.some((role) => ['Print Supplier', 'Ink Supplier'].includes(role))
        ).length || 0
      );
    }
    case 'printerKiosk': {
      return (
        partners?.filter((partner) =>
          ['connected', 'accepted'].includes(partner.status) &&
          partner.partner_roles?.some((role) => role === 'Ink Supplier')
        ).length || 0
      );
    }
    case 'createPack':
      return 0; // Placeholder for future logic
    default:
      return '-';
  }
};

  const handleUpgrade = (type) => {
    setLicenses(prev => ({
      ...prev,
      [type]: { ...prev[type], isEditing: true }
    }));
  };

  const handleLocalPlanChange = (type, newPlan) => {
    setLicenses(prev => ({
      ...prev,
      [type]: { ...prev[type], plan: newPlan }
    }));
  };

  const handlePlanChange = async (type, newPlan) => {
    const success = await updateLicense(type, newPlan);
    if (!success) {
      // Handle error - could show a toast or keep editing mode
      console.error('Failed to update license');
    }
  };

  const handleCancel = (type) => {
    setLicenses(prev => ({
      ...prev,
      [type]: { ...prev[type], isEditing: false }
    }));
  };

  const renderPlanDisplay = (type, currentPlan) => {
    if (!licenses[type].isEditing) {
      return <span className="font-medium">{currentPlan}</span>;
    }

    if (type === 'matchPack' || type === 'createPack') {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={currentPlan === 'No' ? '5' : currentPlan}
            onChange={(e) => {
              const value = Math.max(5, Math.ceil(parseInt(e.target.value) / 5) * 5);
              setLicenses(prev => ({
                ...prev,
                [type]: { ...prev[type], plan: value.toString() }
              }));
            }}
            min="5"
            step="5"
            className="w-20"
          />
        </div>
      );
    }

    return (
      <Select
        value={currentPlan}
        onValueChange={(value) => handleLocalPlanChange(type, value)}
      >
        <SelectTrigger className="w-32" variant="no-focus">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {licenseData.find(item => item.type === type)?.options.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const renderUpgradeButton = (type, isEditing) => {
    // Only Superadmins can modify licensing (any company)
    const canUpgrade = isSuperAdmin;
    
    if (!canUpgrade) {
      return <div className="w-24 h-9"></div>; // Maintain space
    }

    if (!isEditing) {
      return (
        <div className="w-24 h-9 flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleUpgrade(type)}
            className="w-full"
          >
            Upgrade
          </Button>
        </div>
      );
    }

    if (isEditing) {
      return (
        <div className="w-24 h-9 flex items-center justify-end gap-1">
          <Button
            size="sm"
            onClick={() => handlePlanChange(type, licenses[type].plan)}
            className="px-2 text-xs"
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCancel(type)}
            className="px-2 text-xs"
          >
            Cancel
          </Button>
        </div>
      );
    }

    return <div className="w-24 h-9"></div>; // Fallback with consistent space
  };


  const licenseData = [
    {
      name: 'Libraries',
      type: 'libraries',
      options: ['Free', 'Basic', 'Pro']
    },
    {
      name: 'Printer Kiosk',
      type: 'printerKiosk',
      options: ['No', 'Lite', 'Basic', 'Pro']
    },
    {
      name: 'Match Pack',
      type: 'matchPack',
      options: [] // Numeric input
    },
    {
      name: 'Create Pack',
      type: 'createPack',
      options: [] // Numeric input
    }
  ].filter(item => {
    // Only show Match Pack for Brand Owners
    if (item.type === 'matchPack' && !isBrandOwner) {
      return false;
    }
    return true;
  });

  return (
    <Card className="bg-white shadow-none border-gray-200/80">
      <CardHeader>
        <div>
          <CardTitle className="text-xl font-semibold text-gray-800">
            Licensing
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Manage your organization's feature licenses and subscription plans
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Feature</TableHead>
              <TableHead className="w-1/3">Current Plan</TableHead>
              <TableHead className="w-1/3">Used</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {licenseData.map((item) => (
              <TableRow key={item.type}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  {renderPlanDisplay(item.type, licenses[item.type].plan)}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {calculateUsage(item.type)}
                  </span>
                </TableCell>
                <TableCell className="w-24 text-right">
                  {renderUpgradeButton(item.type, licenses[item.type].isEditing)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default LicensingCard;