import { useMemo } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';

export const useCanEditColor = (color) => {
  const { profile } = useProfile();
  const { canEdit: hasRolePermission } = useRoleAccess();
  
  const canEditColor = useMemo(() => {
    // Must have role permission AND own the color
    if (!hasRolePermission || !profile?.organization_id || !color?.organization_id) {
      return false;
    }
    
    // Can only edit colors owned by user's organization
    return profile.organization_id === color.organization_id;
  }, [hasRolePermission, profile?.organization_id, color?.organization_id]);

  const isOwnColor = useMemo(() => {
    if (!profile?.organization_id || !color?.organization_id) {
      return false;
    }
    return profile.organization_id === color.organization_id;
  }, [profile?.organization_id, color?.organization_id]);

  return {
    canEdit: canEditColor,
    isOwnColor,
    hasRolePermission
  };
};

export const useCanEditSelectedColors = (selectedColors) => {
  const { profile } = useProfile();
  const { canEdit: hasRolePermission } = useRoleAccess();
  
  const canEditAll = useMemo(() => {
    if (!hasRolePermission || !profile?.organization_id || !selectedColors?.length) {
      return false;
    }
    
    // All selected colors must be owned by user's organization
    return selectedColors.every(color => 
      color?.organization_id === profile.organization_id
    );
  }, [hasRolePermission, profile?.organization_id, selectedColors]);

  return canEditAll;
};

export default useCanEditColor;