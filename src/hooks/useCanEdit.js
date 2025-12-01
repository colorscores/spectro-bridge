import { useRoleAccess } from './useRoleAccess';

export const useCanEdit = () => {
  const { canEdit } = useRoleAccess();
  return canEdit;
};

export default useCanEdit;