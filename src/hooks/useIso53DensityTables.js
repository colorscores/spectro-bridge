import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to load and cache ISO 5-3 density weighting functions
 * @param {string} status - Status type ('T' for Status T)
 * @returns {Object} Query result with data, loading state, and error
 */
export const useIso53DensityTables = (status = 'T') => {
  try {
    return useQuery({
      queryKey: ['iso_5_3_density_tables', status],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('iso_5_3_density_tables')
          .select('*')
          .eq('status', status)
          .order('wavelength', { ascending: true });

        if (error) {
          console.error('Error loading ISO 5-3 density tables:', error);
          throw error;
        }

        // Convert to format suitable for calculations
        const weightingFunctions = {
          red: {},
          green: {},
          blue: {},
          visual: {}
        };

        data.forEach(row => {
          const wavelength = row.wavelength;
          weightingFunctions.red[wavelength] = row.red_weighting;
          weightingFunctions.green[wavelength] = row.green_weighting;
          weightingFunctions.blue[wavelength] = row.blue_weighting;
          weightingFunctions.visual[wavelength] = row.visual_weighting;
        });

        return {
          raw: data,
          weightingFunctions,
          wavelengthRange: {
            min: Math.min(...data.map(row => row.wavelength)),
            max: Math.max(...data.map(row => row.wavelength))
          }
        };
      },
      staleTime: 1000 * 60 * 60, // Cache for 1 hour
      cacheTime: 1000 * 60 * 60 * 24, // Keep in memory for 24 hours
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
    });
  } catch (error) {
    console.error('useIso53DensityTables: React hooks not available, using fallback', error);
    return { data: null, isLoading: false, error, refetch: async () => ({ data: null }) };
  }
};