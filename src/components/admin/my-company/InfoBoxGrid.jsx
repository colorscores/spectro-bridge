import React from 'react';

import InfoCard from '@/components/admin/my-company/InfoCard';
import OrganizationTypes from '@/components/admin/my-company/OrganizationTypes';
import { Building2, Users, MapPin, KeyRound } from 'lucide-react';

const InfoBoxGrid = ({
  organization,
  locationsCount,
  orgAdmins,
  orgUsers,
  loading,
  onOrgTypeChange,
  withinPanel = false,
  editing = false,
  hideLocalActions = false,
  onOrgTypesDirtyChange,
  registerOrgTypesSave,
  registerOrgTypesCancel,
  hideOrgTypes = false,
}) => {
  return (
    <div className={withinPanel ? "" : "bg-white p-6 rounded-xl shadow-md"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <InfoCard
          icon={Building2}
          title="Company Name"
          subtitle={organization?.name || 'Loading...'}
          valueClassName="mt-2 text-2xl"
        />
        <InfoCard 
          icon={KeyRound} 
          title="Org ID" 
          value={organization?.id?.substring(0, 8).toUpperCase() || '...'} 
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <InfoCard icon={MapPin} title="Locations" value={loading ? '...' : locationsCount} />
        <InfoCard icon={Users} title="Admins" value={loading ? '...' : orgAdmins} />
        <InfoCard icon={Users} title="Users" value={loading ? '...' : orgUsers} />
      </div>

      {!hideOrgTypes && (
        <OrganizationTypes
          selectedTypes={organization?.type || []}
          onTypeChange={editing ? undefined : onOrgTypeChange}
          loading={loading}
          organization={organization}
          editing={editing}
          hideLocalActions={hideLocalActions}
          onDirtyChange={onOrgTypesDirtyChange}
          registerSaveHandler={registerOrgTypesSave}
          registerCancelHandler={registerOrgTypesCancel}
        />
      )}
    </div>
  );
};

export default InfoBoxGrid;