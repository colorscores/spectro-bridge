import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

/**
 * Route guard component that validates matching route parameters
 * and redirects to safe routes if invalid IDs are detected
 */
const MatchingRouteGuard = ({ children }) => {
  const { matchId, colorId } = useParams();
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    const validateRoute = async () => {
      console.log('🛡️ MatchingRouteGuard validating route:', { matchId, colorId });
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!matchId || !uuidRegex.test(matchId)) {
        console.warn('❌ [MatchingRouteGuard] Invalid matchId format:', matchId);
        if (!handledRef.current) {
          handledRef.current = true;
          navigate('/color-matches', { replace: true });
          toast({
            title: 'Invalid Route',
            description: 'Invalid match ID. Redirecting to color matches.',
            variant: 'destructive',
          });
        }
        return;
      }

      if (!colorId || !uuidRegex.test(colorId)) {
        console.warn('❌ [MatchingRouteGuard] Invalid colorId format:', colorId);
        if (!handledRef.current) {
          handledRef.current = true;
          navigate(`/color-matches/${matchId}`, { replace: true });
          toast({
            title: 'Invalid Route',
            description: 'Invalid color ID. Redirecting to match details.',
            variant: 'destructive',
          });
        }
        return;
      }

      // Validate that the color exists in the match request
      try {
        console.log('🔍 Validating match request exists:', matchId);
        const { data: matchRequestData, error: matchError } = await supabase
          .from('match_requests')
          .select(`
            id,
            match_measurements(color_id)
          `)
          .eq('id', matchId)
          .maybeSingle();

        if (matchError || !matchRequestData) {
          console.warn('❌ [MatchingRouteGuard] Match request not found:', { matchId, matchError });
          if (!handledRef.current) {
            handledRef.current = true;
            navigate('/color-matches', { replace: true });
            toast({
              title: 'Match Not Found',
              description: 'The requested match could not be found.',
              variant: 'destructive',
            });
          }
          return;
        }

        console.log('✅ Match request exists, validating color is part of request:', { matchId, colorId });
        
        // Check if the color is part of this match request
        const colorIds = matchRequestData.match_measurements?.map(mm => mm.color_id) || [];
        const isColorInMatch = colorIds.includes(colorId);

        if (!isColorInMatch) {
          console.warn('❌ [MatchingRouteGuard] Color not part of this match request:', { matchId, colorId, colorIds });
          if (!handledRef.current) {
            handledRef.current = true;
            navigate(`/color-matches/${matchId}`, { replace: true });
            toast({
              title: 'Color Not Found',
              description: 'This color is not part of the match request.',
              variant: 'destructive',
            });
          }
          return;
        }

        console.log('✅ Route validation passed - color is part of match request:', { matchId, colorId });

      } catch (error) {
        console.error('❌ [MatchingRouteGuard] Validation error:', error);
        // On unexpected errors, don't redirect to avoid infinite loops
      }
    };

    // Only validate if we have both IDs
    if (matchId && colorId) {
      validateRoute();
    } else if (matchId && !colorId) {
      console.log('✅ Route guard passed - matchId only route:', matchId);
    }
  }, [matchId, colorId, navigate]);

  // Render children if we passed basic validation
  return children;
};

export default MatchingRouteGuard;