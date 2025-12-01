
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, SlidersHorizontal, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnimatePresence, motion } from 'framer-motion';

import MasterReferencePanel from '@/components/match-analysis/MasterReferencePanel';
import MatchesList from '@/components/match-analysis/MatchesList';
import SimilarAnalysisPanel from '@/components/similar-colors/SimilarAnalysisPanel';
import { calculateQualityAssessment, getPrimaryQualityResult } from '@/lib/qualityAssessment';

const fetchColorData = async (colorId) => {
  // Get color data
  const { data: colorData, error: colorError } = await supabase
    .from('colors')
    .select('*')
    .eq('id', colorId)
    .maybeSingle();
  if (colorError) throw new Error(`Could not fetch color details: ${colorError.message}`);
  if (!colorData) throw new Error('Color not found or access denied');

  // Find all match requests that contain this color  
  const { data: matchMeasurements, error: measurementsError } = await supabase
    .from('match_measurements')
    .select('match_request_id')
    .eq('color_id', colorId);
  if (measurementsError) throw new Error(`Could not fetch match measurements: ${measurementsError.message}`);

  if (!matchMeasurements?.length) {
    return { color: colorData, matches: [] };
  }

  // Get unique match request IDs
  const matchRequestIds = [...new Set(matchMeasurements.map(m => m.match_request_id))];
  
  // Fetch details for each match request using the same RPC as the working detail page
  const matchRequestsData = await Promise.all(
    matchRequestIds.map(async (requestId) => {
      try {
        const { data, error } = await supabase.rpc('get_match_request_details', {
          p_match_request_id: requestId
        });
        if (error) {
          console.error(`Error fetching match request ${requestId}:`, error);
          return null;
        }
        return data;
      } catch (error) {
        console.error(`Error fetching match request ${requestId}:`, error);
        return null;
      }
    })
  );

  // Normalize RPC rows (array) into aggregated matchRequest objects with colors[]
  const normalizeMatchRequest = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const first = rows[0] || {};
  return {
    id: first.match_request_id,
    name: first.match_request_name,
    status: first.match_request_status,
    created_at: first.match_request_created_at,
    updated_at: first.match_request_updated_at,
    organization_id: first.match_request_organization_id,
    organization_name: first.match_request_organization_name,
    // Include IDs so we can look up names when RPC omits them
    shared_with_org_id: first.shared_with_org_id || null,
    routed_to_org_id: first.routed_to_org_id || null,
    shared_with_org_name: first.shared_with_org_name || null,
    routed_to_org_name: first.routed_to_org_name || null,
    requestor_org_name: first.requestor_org_name || null,
    receiver_org_name: first.shared_with_org_name || first.routed_to_org_name || null,
    shared_with: first.shared_with || first.shared_with_org_name || null,
    location_name: first.location_name || null,
    location: first.location || first.match_request_location || first.location_name || null,
    job_id: first.job_id || null,
    print_condition: first.match_request_print_condition,
      print_condition_name: first.print_condition_name || first.match_request_print_condition,
      print_process: first.print_condition_print_process || first.match_request_print_process,
      substrate: first.print_condition_substrate || first.match_request_substrate,
      quality_set_id: first.match_request_quality_set_id,
      quality_set: first.quality_set,
      colors: rows.map(r => {
        const mm = r.match_measurement || {};
        const colorId = mm.color_id || r.match_request_color_id || null;
        return {
          id: colorId,
          color_id: colorId,
          hex: r.match_request_color_hex || mm.matched_hex || null,
          lab_l: mm.lab_l ?? mm.lab?.L ?? null,
          lab_a: mm.lab_a ?? mm.lab?.a ?? mm.lab?.A ?? null,
          lab_b: mm.lab_b ?? mm.lab?.b ?? mm.lab?.B ?? null,
          resolved_lab: mm.resolved_lab ?? null,
          reference_lab: mm.reference_lab ?? null,
          quality_results: mm.quality_results ?? null,
          primary_quality_result: mm.primary_quality_result ?? null,
          match_measurement: mm,
          measurement_id: mm.id,
          status: mm.status || null,
          matched_by_name: r.shared_with_org_name || r.routed_to_org_name || mm.matched_by_name || null,
          match_location: r.location_name || mm.match_location || null,
          match_print_condition: mm.match_print_condition || r.match_request_print_condition,
          print_condition_print_process: r.print_condition_print_process,
          match_request_id: r.match_request_id,
          match_measurement_state: mm.match_measurement_state || mm.status,
          quality_set_name: mm.quality_set_name || r.quality_set?.name,
        };
      })
    };
  };

  // Filter out null results and process the data
let validMatchRequests = matchRequestsData
  .map(item => Array.isArray(item) ? normalizeMatchRequest(item) : (item?.match_request || item))
  .filter(Boolean);

// Ensure consistent field names across shapes
validMatchRequests = validMatchRequests.map(mr => ({
  ...mr,
  shared_with_org_name: mr?.shared_with_org_name ?? mr?.shared_with ?? null,
  routed_to_org_name: mr?.routed_to_org_name ?? mr?.routed_to ?? null,
  receiver_org_name: mr?.receiver_org_name ?? mr?.shared_with_org_name ?? mr?.routed_to_org_name ?? null,
  location_name: mr?.location_name ?? mr?.location ?? null,
}));
  
  // Build organization name map for lookups (shared_with_org_id, routed_to_org_id)
  let orgNameById = {};
  try {
    const orgIds = Array.from(new Set(
      (validMatchRequests || [])
        .flatMap(mr => [mr.shared_with_org_id, mr.routed_to_org_id])
        .filter(Boolean)
    ));
    if (orgIds.length) {
      const { data: orgRows, error: orgErr } = await supabase
        .from('organizations')
        .select('id,name')
        .in('id', orgIds);
      if (!orgErr && Array.isArray(orgRows)) {
        orgNameById = Object.fromEntries(orgRows.map(r => [r.id, r.name]));
      }
    }
  } catch (e) {
    console.warn('Organization lookup failed:', e);
  }
  
  // Fetch all measurements for this color to resolve quality_set_id per request (kept for compatibility)
  const { data: allMeasurements } = await supabase
    .from('match_measurements')
    .select('*')
    .eq('color_id', colorId);
  
  // Extract matches for the specific color using enhanced RPC data
  let processedMatches = [];
  
  for (const matchRequest of validMatchRequests) {
    // Find the color in this match request
    const colorInRequest = matchRequest.colors?.find(c => c.color_id === colorId);
    
    if (colorInRequest) {
      const mm = colorInRequest.match_measurement || {};
      const resolvedLab = mm.resolved_lab || mm.lab || null;
      const referenceLab = colorInRequest.reference_lab || null;

      // Create a match object using enhanced RPC data
      const match = {
        id: `${matchRequest.id}-${colorId}`,
        match_request_id: matchRequest.id,
        color_id: colorId,
        measurement_id: mm.id || null,
matched_by_name:
  orgNameById[matchRequest.shared_with_org_id]
  || matchRequest.shared_with_org_name
  || orgNameById[matchRequest.routed_to_org_id]
  || matchRequest.routed_to_org_name
  || ((mm.matched_by_name && mm.matched_by_name !== 'Unknown') ? mm.matched_by_name : null)
  || ((colorInRequest.matched_by_name && colorInRequest.matched_by_name !== 'Unknown') ? colorInRequest.matched_by_name : null)
  || matchRequest.shared_with
  || null,
        organization_id: matchRequest.organization_id,
        job_id: matchRequest.job_id,
match_location:
  (colorInRequest.match_location)
  || matchRequest.location_name
  || matchRequest.location
  || mm.match_location
  || null,
        match_print_process: mm.match_print_process || matchRequest.print_process,
        match_print_condition: matchRequest.print_condition,
        status: mm.status || 'New',
        created_at: mm.created_at || matchRequest.date_shared,
        // Reference color Lab (target)
        target_color_lab_l: colorInRequest.lab_l,
        target_color_lab_a: colorInRequest.lab_a,
        target_color_lab_b: colorInRequest.lab_b,
        // Per-row reference lab for dE
        reference_lab: referenceLab,
        // Quality set
        quality_set_id: mm.quality_set_id || null,
        // Visuals
        sample_color_hex: mm.matched_hex || colorInRequest.hex,
        // Enhanced Lab
        resolved_lab: resolvedLab,
        // Carry through full measurement for future use
        match_measurement: mm,
      };
      
      processedMatches.push(match);
    }
  }
  
  // Resolve quality set names (if any)
  const qsIds = [...new Set(processedMatches.map(m => m.quality_set_id).filter(Boolean))];
  if (qsIds.length) {
    const { data: qsRows, error: qsErr } = await supabase
      .from('quality_sets')
      .select('id,name')
      .in('id', qsIds);
    if (!qsErr && Array.isArray(qsRows)) {
      const nameMap = Object.fromEntries(qsRows.map(r => [r.id, r.name]));
      processedMatches = processedMatches.map(m => ({
        ...m,
        quality_set_name: nameMap[m.quality_set_id] || null,
      }));
    }
  }
  
  if (processedMatches && processedMatches.length) {
    const m0 = processedMatches[0];
    console.debug('[ColorMatchAnalysis] sample', {
      match_request_id: m0.match_request_id,
      matched_by_name: m0.matched_by_name,
      match_location: m0.match_location,
    });
  }

  return { color: colorData, matches: processedMatches };
};

const ColorMatchAnalysis = () => {
  const { colorId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['colorMatchAnalysis', colorId],
    queryFn: () => fetchColorData(colorId),
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('last_activity');

  const filteredMatches = data?.matches.filter(match =>
    (match.matched_by_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBack = () => navigate('/assets/colors');

  if (isLoading) {
    return <AnalysisSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-red-500">Error: {error.message}</p>
        <Button onClick={handleBack} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const { color, matches } = data;

  return (
    <>
      <Helmet><title>{color?.name ? `Match Analysis: ${color.name}` : 'Match Analysis'}</title></Helmet>
      <div className="flex flex-col h-full bg-gray-50">
        <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Go back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-gray-800">{color.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by</span>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_activity">Last Activity</SelectItem>
                    <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                    <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                    <SelectItem value="de_asc">dE (Low to High)</SelectItem>
                    <SelectItem value="de_desc">dE (High to Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="bg-white">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search matches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white"
                />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-grow flex p-4 gap-4 overflow-hidden">
          <AnimatePresence>
            <motion.div 
              className="w-1/4"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <MasterReferencePanel color={color} />
            </motion.div>
            <motion.div 
              className="w-1/2 flex flex-col"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeInOut" }}
            >
              <MatchesList matches={filteredMatches} controls={{ deltaE: 'dE00' }} />
            </motion.div>
            <motion.div 
              className="w-1/4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4, ease: "easeInOut" }}
            >
              <SimilarAnalysisPanel 
                masterColor={color} 
                similarColors={filteredMatches?.map(m => ({
                  id: m.id,
                  name: m.matched_by_name || 'Match',
                  lab_l: m.target_color_lab_l,
                  lab_a: m.target_color_lab_a,
                  lab_b: m.target_color_lab_b,
                  hex: m.sample_color_hex || '#E5E7EB',
                  standard_type: 'Custom'
                })) || []}
                deltaEType="2000"
                referenceLab={null}
                threshold={3.0}
                selectedSimilarId={null}
                onSelectSimilar={() => {}}
                illuminantKey="D65"
                loading={isLoading}
                onFilteredColorsChange={() => {}}
                onStatsRowSelect={() => {}}
              />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
};

const AnalysisSkeleton = () => (
    <div className="flex flex-col h-full bg-gray-50">
        <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-7 w-48" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-28" />
                    <Skeleton className="h-10 w-64" />
                </div>
            </div>
        </header>
        <main className="flex-grow flex p-4 gap-4 overflow-hidden">
            <div className="w-1/4"><Skeleton className="h-full w-full" /></div>
            <div className="w-1/2"><Skeleton className="h-full w-full" /></div>
            <div className="w-1/4"><Skeleton className="h-full w-full" /></div>
        </main>
    </div>
);

export default ColorMatchAnalysis;
