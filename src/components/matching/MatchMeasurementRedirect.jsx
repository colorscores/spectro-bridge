import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const MatchMeasurementRedirect = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      if (!id) {
        toast({
          title: 'Invalid link',
          description: 'Missing match measurement ID.',
          variant: 'destructive',
        });
        navigate('/color-matches', { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from('match_measurements')
        .select('match_request_id, color_id')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({
          title: 'Not found',
          description: 'That match measurement could not be found.',
          variant: 'destructive',
        });
        navigate('/color-matches', { replace: true });
        return;
      }

      const { match_request_id, color_id } = data;
      navigate(`/color-matches/${match_request_id}/matching/${color_id}`, { replace: true });
    };

    run();
  }, [id, navigate]);

  return (
    <main className="p-6">
      <p className="text-sm opacity-70">Loading match…</p>
    </main>
  );
};

export default MatchMeasurementRedirect;
