import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { useTestchartsData } from '@/context/TestchartsContext';

import { useCgatsImport } from '@/hooks/useCgatsImport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeft, Upload, Save, X } from 'lucide-react';
import TestChartVisualization from '@/components/testcharts/TestChartVisualization';
import { getChannelName, formatPatchCount } from '@/utils/colorUtils';
import { Badge } from '@/components/ui/badge';

const SPECTROPHOTOMETERS = [
  'X-Rite i1Pro 2',
  'X-Rite i1Pro 3',
  'X-Rite eXact',
  'X-Rite eXact 2',
  'Konica Minolta FD-9',
  'Konica Minolta FD-7',
  'Techkon SpectroDens',
  'Barbieri Spectro LFP qb',
  'CGS ORIS Color Tuner'
];

const PAGE_SIZES = [
  { name: 'A4', width: 210, height: 297 },
  { name: 'A3', width: 297, height: 420 },
  { name: 'Letter', width: 216, height: 279 },
  { name: 'Legal', width: 216, height: 356 },
  { name: 'Tabloid', width: 279, height: 432 }
];

const TestchartDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { refetch } = useTestchartsData();
const [patchSets, setPatchSets] = useState([]);
useEffect(() => {
  const fetchPatchSets = async () => {
    if (!profile?.organization_id) return;
    const { data, error } = await supabase
      .from('patch_sets')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('name');
    if (!error) setPatchSets(data || []);
  };
  fetchPatchSets();
}, [profile?.organization_id]);
  const [loading, setLoading] = useState(false);
  const [testChart, setTestChart] = useState({
    name: '',
    instrument: '',
    page_size: '',
    patch_size: 6,
    patch_set_id: '',
    number_of_patches: 0,
    printing_channels: '',
    number_of_pages: 1
  });
  
  const [patchSetData, setPatchSetData] = useState(null);

  // Get patchSetId from URL params for creating test charts from patch set detail page
  const urlParams = new URLSearchParams(window.location.search);
  const patchSetIdFromUrl = urlParams.get('patchSetId');

  const {
    handleAddCgatsClick,
    fileInputRef,
    isCgatsAddOpen,
    setIsCgatsAddOpen,
    handleAddColorsFromCgats
  } = useCgatsImport();

  const [importedData, setImportedData] = useState(null);

  const isEditing = id !== 'new';

  useEffect(() => {
    if (isEditing) {
      fetchTestChart();
    } else if (patchSetIdFromUrl) {
      // Pre-select patch set when creating from patch set detail page
      setTestChart(prev => ({ ...prev, patch_set_id: patchSetIdFromUrl }));
      loadPatchSetData(patchSetIdFromUrl);
    }
  }, [id, isEditing, patchSetIdFromUrl]);

  const fetchTestChart = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('test_charts')
        .select(`
          *,
          patch_set:patch_sets(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setTestChart(data);
      
      // Set patch set data for breadcrumbs
      if (data.patch_set) {
        setPatchSetData(data.patch_set);
      }

      // Fetch patch data from patch set if it exists
      if (data.patch_set_id) {
        const { data: patchData, error: patchError } = await supabase
          .from('patch_set_patches')
          .select('*')
          .eq('patch_set_id', data.patch_set_id)
          .order('patch_index');

        if (!patchError && patchData?.length > 0) {
          // Transform patch data back to the format expected by TestChartVisualization
          const transformedPatches = patchData.map(patch => ({
            name: patch.patch_name,
            hex: patch.hex,
            cmyk: patch.cmyk
          }));
          setImportedData(transformedPatches);
        }
      }
    } catch (error) {
      console.error('Error fetching test chart:', error);
      toast.error('Failed to load test chart');
    } finally {
      setLoading(false);
    }
  };

  const handleCgatsImport = (cgatsData) => {
    console.log('CGATS data received:', cgatsData);
    
    if (cgatsData && cgatsData.length > 0) {
      // Determine channels from CGATS data structure
      const channels = [];
      let channelString = 'CMYK'; // Default
      
      // Check first sample for available data fields
      const firstSample = cgatsData[0];
      console.log('First sample:', firstSample);
      
      if (firstSample) {
        // Check for multi-color channels first (7CLR, 6CLR, etc.)
        if (firstSample.channelCount) {
          channelString = `${firstSample.channelCount}CLR`;
        } else if (firstSample.multiColorChannels) {
          // Count the number of color channels
          const channelKeys = Object.keys(firstSample.multiColorChannels);
          const maxChannelCount = Math.max(...channelKeys.map(key => {
            const match = key.match(/(\d+)CLR_/);
            return match ? parseInt(match[1]) : 0;
          }));
          channelString = maxChannelCount > 0 ? `${maxChannelCount}CLR` : 'Unknown';
        } else if (firstSample.cmyk) {
          channelString = 'CMYK';
        } else {
          // Look for CMYK or other color channel data in object keys
          const dataKeys = Object.keys(firstSample);
          const colorChannels = dataKeys.filter(key => 
            key.includes('cmyk') || 
            key.includes('rgb') || 
            key.includes('lab') ||
            key.toUpperCase().includes('CMYK_') ||
            key.toUpperCase().includes('COLOR_')
          );
          
          console.log('Color channels found:', colorChannels);
          channelString = colorChannels.length > 0 ? 'CMYK' : 'Unknown';
        }
      }

      const updatedTestChart = {
        ...testChart,
        patch_set_name: 'Imported CGATS Data',
        number_of_patches: cgatsData.length,
        printing_channels: channelString
      };

      console.log('Updating test chart with:', updatedTestChart);
      setTestChart(updatedTestChart);
      setImportedData(cgatsData);
      
      // Calculate pages with the imported data
      if (updatedTestChart.page_size && updatedTestChart.patch_size) {
        calculatePages(cgatsData.length, updatedTestChart.page_size, updatedTestChart.patch_size);
      }
      
      toast.success(`Imported ${cgatsData.length} patches successfully`);
    }
  };

  const calculatePages = (patchCount, pageSize, patchSize) => {
    if (!pageSize || !patchSize || patchCount === 0) return;

    const selectedPageSize = PAGE_SIZES.find(p => p.name === pageSize);
    if (!selectedPageSize) return;

    // Calculate patches per page based on page and patch dimensions
    // Using same calculations as TestChartVisualization component
    const margin = 10; // 10mm margins
    const spacing = 1; // 1mm spacing between patches
    const patchesPerRow = Math.floor((selectedPageSize.width - 2 * margin) / (patchSize + spacing));
    const patchesPerCol = Math.floor((selectedPageSize.height - 2 * margin) / (patchSize + spacing));
    const patchesPerPage = patchesPerRow * patchesPerCol;
    
    const numberOfPages = Math.ceil(patchCount / patchesPerPage);
    
    setTestChart(prev => ({
      ...prev,
      number_of_pages: numberOfPages
    }));
  };

  // Load patch data when patch set is selected
  const loadPatchSetData = async (patchSetId) => {
    if (!patchSetId) return;

    try {
      // Get patch set details
      const { data: patchSetData, error: patchSetError } = await supabase
        .from('patch_sets')
        .select('*')
        .eq('id', patchSetId)
        .single();

      if (patchSetError) throw patchSetError;

      // Get patches for this patch set
      const { data: patchData, error: patchError } = await supabase
        .from('patch_set_patches')
        .select('*')
        .eq('patch_set_id', patchSetId)
        .order('patch_index');

      if (patchError) throw patchError;

      // Update test chart with patch set info
      setTestChart(prev => ({
        ...prev,
        number_of_patches: patchSetData.number_of_patches,
        printing_channels: patchSetData.printing_channels
      }));

      // Transform patch data for visualization
      if (patchData?.length > 0) {
        const transformedPatches = patchData.map(patch => ({
          name: patch.patch_name,
          hex: patch.hex,
          cmyk: patch.cmyk
        }));
        setImportedData(transformedPatches);
      }

      // Recalculate pages if page size and patch size are set
      if (testChart.page_size && testChart.patch_size) {
        calculatePages(patchSetData.number_of_patches, testChart.page_size, testChart.patch_size);
      }

    } catch (error) {
      console.error('Error loading patch set data:', error);
      toast.error('Failed to load patch set data');
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      console.log('Profile:', profile);
      console.log('Profile organization_id:', profile?.organization_id);
      console.log('Supabase auth session:', supabase.auth.getSession());
      console.log('Test chart data:', testChart);

      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
      
      if (!session) {
        toast.error('Authentication session expired. Please refresh the page or log in again.');
        console.log('No active session - auth required');
        // Optionally redirect to login
        // navigate('/login');
        return;
      }

      if (!profile?.organization_id) {
        toast.error('No organization found for user');
        console.log('No organization_id found in profile');
        return;
      }

      const data = {
        ...testChart,
        organization_id: profile.organization_id,
        created_by: profile.id,
        last_edited_by: profile.id
      };

      console.log('Data to save:', data);

      let testChartId = id;

      if (isEditing) {
        const { error } = await supabase
          .from('test_charts')
          .update(data)
          .eq('id', id);

        if (error) throw error;
        toast.success('Test chart updated successfully');
      } else {
        const { data: insertData, error } = await supabase
          .from('test_charts')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        testChartId = insertData.id;
        toast.success('Test chart created successfully');
      }

      // Save patch data if available
      if (importedData && importedData.length > 0 && !testChart.patch_set_id) {
        // Only save patch data directly if no patch set is selected
        // This is for legacy compatibility or when creating patches inline
        console.log('Saving patch data directly to test chart (legacy mode)');
        
        // This functionality has been moved to patch sets
        toast.warning('Direct patch import is deprecated. Please use patch sets instead.');
      }

      // Trigger refetch to update the list
      refetch();
      
      navigate('/assets/testcharts');
    } catch (error) {
      console.error('Error saving test chart:', error);
      toast.error('Failed to save test chart');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setTestChart(prev => {
      const updated = { ...prev, [field]: value };
      
      // Recalculate pages when relevant fields change
      if (field === 'page_size' || field === 'patch_size') {
        calculatePages(updated.number_of_patches, updated.page_size, updated.patch_size);
      }
      
      return updated;
    });
  };

  return (
    <>
      <Helmet>
        <title>{isEditing ? 'Edit Test Chart' : 'New Test Chart'} - Brand Asset Management</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col h-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/assets/testcharts')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Test Charts
            </Button>
            <div className="flex-1">
              {/* Breadcrumbs */}
              {isEditing && patchSetData && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>Patch Set</span>
                  <span>/</span>
                  <span>{patchSetData.name}</span>
                  <span>/</span>
                  <span>{testChart.name}</span>
                </div>
              )}
              <h1 className="text-2xl font-bold text-foreground">
                {isEditing ? 'Edit Test Chart' : 'New Test Chart'}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-muted-foreground">
                  {testChart.name || 'Testchart Name'}
                  {testChart.instrument && ` - For Printer: ${testChart.instrument}`}
                </p>
                {isEditing && testChart.patch_set && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <span>Patch set {testChart.patch_set.name}</span>
                    <span>•</span>
                    <span>{formatPatchCount(testChart.patch_set.number_of_patches)}</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/assets/testcharts')}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        <div className="flex gap-6 flex-1">
          {/* Left Panel - Form */}
          <div className="w-1/3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Chart Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Test chart name</Label>
                  <Input
                    id="name"
                    value={testChart.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="Enter test chart name"
                  />
                </div>

                <div>
                  <Label htmlFor="instrument">Formatted for Instrument</Label>
                  <Select value={testChart.instrument} onValueChange={(value) => handleFieldChange('instrument', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select instrument" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECTROPHOTOMETERS.map((instrument) => (
                        <SelectItem key={instrument} value={instrument}>
                          {instrument}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pageSize">Page Size</Label>
                    <Select value={testChart.page_size} onValueChange={(value) => handleFieldChange('page_size', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((size) => (
                          <SelectItem key={size.name} value={size.name}>
                            {size.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="patchSize">Patch size (mm)</Label>
                    <Input
                      id="patchSize"
                      type="number"
                      value={testChart.patch_size}
                      onChange={(e) => handleFieldChange('patch_size', Number(e.target.value))}
                      placeholder="6"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Patch Set</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="patchSet">Select Patch Set</Label>
                  <Select 
                    value={testChart.patch_set_id} 
                    onValueChange={(value) => {
                      handleFieldChange('patch_set_id', value);
                      // When patch set changes, load its patches
                      loadPatchSetData(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a patch set" />
                    </SelectTrigger>
                    <SelectContent>
                      {patchSets?.map((patchSet) => (
                        <SelectItem key={patchSet.id} value={patchSet.id}>
                          {patchSet.name} ({patchSet.number_of_patches} patches)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="numberOfPatches">Number of Patches:</Label>
                  <Input
                    id="numberOfPatches"
                    value={testChart.number_of_patches}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                <div>
                  <Label htmlFor="channels">Channels:</Label>
                  <Input
                    id="channels"
                    value={testChart.printing_channels}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Visualization */}
          <div className="flex-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Test Chart Preview</CardTitle>
              </CardHeader>
              <CardContent className="h-full">
                <TestChartVisualization
                  patches={importedData || []}
                  pageSize={testChart.page_size}
                  patchSize={testChart.patch_size}
                  numberOfPages={testChart.number_of_pages}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hidden file input for CGATS import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".cgats,.txt,.dat"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = async (event) => {
                try {
                  const content = event.target.result;
                  const { parseCgats } = await import('@/lib/cgatsParser');
                  const parsedData = parseCgats(content);
                  handleCgatsImport(parsedData);
                } catch (error) {
                  console.error('CGATS parsing error:', error);
                  toast.error('Failed to parse CGATS file');
                }
              };
              reader.readAsText(file);
            }
          }}
          className="hidden"
        />
      </motion.div>
    </>
  );
};

export default TestchartDetail;