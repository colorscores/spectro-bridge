import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { handleSubstrateOptionsMigration } from '@/lib/migrations/substrateData';
import { handleQualitySetMigration } from '@/lib/migrations/qualitySets';
import { clearAndReloadAstmCache } from '@/utils/astmCacheManager';

const useDataMigration = () => {
  
  const { profile, loading: profileLoading } = useProfile();
  const [migrationLoading, setMigrationLoading] = useState(true);
  const [migrationError, setMigrationError] = useState(null);

  useEffect(() => {
    const runMigrations = async () => {
      if (profileLoading) return;

      // Skip migrations if no profile or no organization context
      if (!profile || !profile.organization_id) {
        setMigrationLoading(false);
        return;
      }
      
      setMigrationLoading(true);
      setMigrationError(null);

      try {
        await handleSubstrateOptionsMigration(supabase, toast, profile.organization_id);
        await handleQualitySetMigration(supabase, toast, profile.id, profile.organization_id);
        
        // Ensure ASTM cache is cleared and reloaded with reconstructed database
        await clearAndReloadAstmCache();
      } catch (error) {
        console.error("Migration failed:", error);
        setMigrationError(error.message);
        toast({
          title: 'Data Migration Failed',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setMigrationLoading(false);
      }
    };

    runMigrations();
  }, [profile, profileLoading, toast]);

  return { migrationLoading, migrationError };
};

export default useDataMigration;