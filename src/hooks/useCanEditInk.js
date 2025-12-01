import { useMemo } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';

export const useCanEditInk = (ink) => {
  const { profile } = useProfile();
  const { canEdit: hasRolePermission, isSuperadmin } = useRoleAccess();
  
  const canEditInk = useMemo(() => {
    // Must have role permission first
    if (!hasRolePermission || !profile?.organization_id || !ink?.organization_id) {
      return false;
    }
    
    // Superadmin can edit any ink across organizations
    if (isSuperadmin) {
      return true;
    }
    
    // Can only edit inks owned by user's organization
    return profile.organization_id === ink.organization_id;
  }, [hasRolePermission, isSuperadmin, profile?.organization_id, ink?.organization_id]);

  const isOwnInk = useMemo(() => {
    if (!profile?.organization_id || !ink?.organization_id) {
      return false;
    }
    return profile.organization_id === ink.organization_id;
  }, [profile?.organization_id, ink?.organization_id]);

  return {
    canEdit: canEditInk,
    isOwnInk,
    hasRolePermission
  };
};

export default useCanEditInk;