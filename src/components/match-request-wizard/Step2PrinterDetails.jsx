import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

const Step2PrinterDetails = ({ 
  formData, 
  setFormData, 
  partnerOrgOptions, 
  getLocationsForOrg, 
  printConditions, 
  fetchLocationsForOrg,
  showAllPartners,
  setShowAllPartners,
  hasPartialAccess,
  selectedPartnerAccess,
  isValidatingPartners
}) => {
  const handleChange = (field, value) => {
    // Reset location when org changes
    if (field === 'partnerOrgId') {
      setFormData(prev => ({ ...prev, [field]: value, partnerLocationId: '' }));
      // Fetch locations for the selected organization
      if (value && fetchLocationsForOrg) {
        fetchLocationsForOrg(value);
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const locationOptions = formData.partnerOrgId ? getLocationsForOrg(formData.partnerOrgId) : [];

  return (
    <div className="space-y-4">
      {/* Show All Partners Checkbox */}
      <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-md">
        <Checkbox 
          id="showAllPartners" 
          checked={showAllPartners}
          onCheckedChange={setShowAllPartners}
        />
        <Label 
          htmlFor="showAllPartners" 
          className="text-sm font-normal cursor-pointer"
        >
          Show all suppliers (including those without access to all colors)
        </Label>
      </div>

      {/* Partner Organization Select */}
      <div>
        <Label htmlFor="partnerOrg">Partner Organization</Label>
        <Select 
          value={formData.partnerOrgId} 
          onValueChange={(value) => handleChange('partnerOrgId', value)}
          disabled={isValidatingPartners}
        >
          <SelectTrigger id="partnerOrg">
            <SelectValue placeholder={
              isValidatingPartners 
                ? "Validating partner access..." 
                : "Select partner organization"
            } />
          </SelectTrigger>
          <SelectContent className="bg-background border z-[1000]">
            {partnerOrgOptions.length === 0 && !showAllPartners ? (
              <div className="p-2 text-sm text-muted-foreground">
                No partners have access to all selected colors. Enable "Show all suppliers" to see more options.
              </div>
            ) : (
              partnerOrgOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Warning for Partial Access */}
      {hasPartialAccess && selectedPartnerAccess && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Colors Not Shared</AlertTitle>
          <AlertDescription>
            Colors in this match request are not all shared with the selected supplier/location. 
            Please update color or supplier sharing tags to share or match these colors.
          </AlertDescription>
        </Alert>
      )}
      <div>
        <Label htmlFor="partnerLocation">Location</Label>
        <Select 
          value={formData.partnerLocationId} 
          onValueChange={(value) => handleChange('partnerLocationId', value)}
          disabled={!formData.partnerOrgId}
        >
          <SelectTrigger id="partnerLocation">
            <SelectValue placeholder={formData.partnerOrgId ? "Select location" : "Select organization first"} />
          </SelectTrigger>
          <SelectContent className="bg-background border z-[1000]">
            {locationOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="printCondition">Print Condition</Label>
        <Select value={formData.printConditionId} onValueChange={(value) => handleChange('printConditionId', value)}>
          <SelectTrigger id="printCondition" className={printConditions.length === 0 ? "text-muted-foreground" : ""}>
            <SelectValue placeholder={printConditions.length === 0 ? "Print condition will be specified later" : "Select print condition"} />
          </SelectTrigger>
          <SelectContent className="bg-background border z-[1000]">
            {printConditions.map(condition => (
               <SelectItem key={condition.id} value={condition.id}>{condition.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {printConditions.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Print condition will be coordinated with the selected partner
          </p>
        )}
      </div>
    </div>
  );
};

export default Step2PrinterDetails;