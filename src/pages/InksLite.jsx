import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import Breadcrumb from '@/components/Breadcrumb';

const InksLite = () => {
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('inks')
        .select('id, name, created_at')
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error('[InksLite] fetch error:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (!profileLoading && profile?.organization_id) fetchData();
  }, [profileLoading, profile?.organization_id, fetchData]);

  return (
    <>
      <Helmet>
        <title>Inks (Lite) - Printing Assets</title>
        <meta name="description" content="Quick list of inks for your organization." />
        <link rel="canonical" href="/assets/inks" />
      </Helmet>

      <div className="flex flex-col h-full px-6 pt-6 space-y-6">
        <Breadcrumb />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Temporary lite view while we stabilize the full Inks page.</div>
          <Button variant="outline" size="sm" onClick={fetchData}>Refresh</Button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="overflow-x-auto">
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || profileLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={2}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-destructive">Failed to load inks: {String(error.message || error)}</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">No inks yet.</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/assets/inks/${r.id}`)}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
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

export default InksLite;
