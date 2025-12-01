import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import Breadcrumb from '@/components/Breadcrumb';

const ColorMatchesLite = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supabase.rpc('get_match_requests_for_current_user');
      if (res.error) throw res.error;
      setRows(res.data || []);
    } catch (e) {
      console.error('[ColorMatchesLite] fetch error:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profileLoading) fetchData();
  }, [profileLoading, fetchData]);

  return (
    <>
      <Helmet>
        <title>Color Matches (Lite) - Spectral Color Tool</title>
        <meta name="description" content="Lightweight view of color match requests." />
        <link rel="canonical" href="/color-matches" />
      </Helmet>

      <div className="flex flex-col h-full px-6 pt-6 space-y-6">
        <Breadcrumb />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Temporary lite view while the full Matches page is being stabilized.
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>Refresh</Button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Project ID</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Print Condition</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || profileLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-destructive">
                      Failed to load matches: {String(error.message || error)}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">No matching jobs.</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/color-matches/${r.id}`)}>
                      <TableCell className="font-medium">{r.job_id}</TableCell>
                      <TableCell>{r.project_id || '-'}</TableCell>
                      <TableCell>{r.location || '-'}</TableCell>
                      <TableCell>{r.print_condition || '-'}</TableCell>
                      <TableCell>{r.status || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};

export default ColorMatchesLite;
