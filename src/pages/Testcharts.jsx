import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useTestchartsData } from '@/context/TestchartsContext';
import TestchartsHeader from '@/components/testcharts/TestchartsHeader';
import TestchartsTableToolbar from '@/components/testcharts/TestchartsTableToolbar';
import TestchartsTable from '@/components/testcharts/TestchartsTable';
import HierarchicalTestchartsView from '@/components/testcharts/HierarchicalTestchartsView';
import PatchSetDetailView from '@/components/testcharts/PatchSetDetailView';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import GenericDetailPane from '@/components/assets/GenericDetailPane';

const Testcharts = () => {
  const navigate = useNavigate();
  const { testcharts, loading: testchartsLoading, error: testchartsError, refetch: refetchTestcharts } = useTestchartsData();
  const [selectedItems, setSelectedItems] = useState({ testcharts: new Set() });
  const [activeAsset, setActiveAsset] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activePatchSet, setActivePatchSet] = useState(null);

  const filteredTestcharts = useMemo(() => {
    if (!testcharts) return [];
    return testcharts.filter(chart => 
      chart.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (chart.instrument && chart.instrument.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (chart.page_size && chart.page_size.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [testcharts, searchTerm]);

  const numSelected = useMemo(() => {
    return selectedItems.testcharts.size;
  }, [selectedItems]);

  const handleRowClick = (item) => {
    const assetData = {
      ...item,
      assetType: 'Test Chart'
    };
    
    if (activeAsset && activeAsset.id === item.id) {
      setActiveAsset(null);
    } else {
      setActiveAsset(assetData);
    }
  };

  const closePane = () => {
    setActiveAsset(null);
  };

  const handleDelete = async () => {
    const chartIdsToDelete = Array.from(selectedItems.testcharts);

    if (chartIdsToDelete.length === 0) {
      toast.error("No test charts selected for deletion.");
      return;
    }

    try {
      const { error } = await supabase
        .from('test_charts')
        .delete()
        .in('id', chartIdsToDelete);

      if (error) throw error;

      toast.success('Selected test charts deleted successfully.');
      setSelectedItems({ testcharts: new Set() });
      refetchTestcharts();
    } catch (error) {
      toast.error(`Failed to delete test charts: ${error.message}`);
    }
  };

  const handleEdit = () => {
    if (selectedItems.testcharts.size !== 1) {
      toast.error("Please select a single test chart to edit.");
      return;
    }

    const chartId = selectedItems.testcharts.values().next().value;
    navigate(`/assets/testcharts/${chartId}`);
  };

  const handleResetView = () => {
    setSelectedItems({ testcharts: new Set() });
    refetchTestcharts();
    toast.success('Test charts view reset successfully!');
  };

  const handleViewDetails = (item) => {
    navigate(`/assets/testcharts/${item.id}`);
  };

  const handlePatchSetClick = (patchSet) => {
    // Get test charts for this patch set
    const patchSetTestCharts = testcharts.filter(chart => 
      chart.patch_set && chart.patch_set.id === patchSet.id
    );
    
    setActivePatchSet({
      ...patchSet,
      testCharts: patchSetTestCharts
    });
  };

  const handleBackToPatchSets = () => {
    setActivePatchSet(null);
  };

  return (
    <>
      <Helmet>
        <title>Test Charts - Brand Asset Management</title>
        <meta name="description" content="Manage test charts for color calibration and quality control." />
      </Helmet>
      {activePatchSet ? (
        <PatchSetDetailView
          patchSet={activePatchSet}
          testCharts={activePatchSet.testCharts || []}
          onBack={handleBackToPatchSets}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col h-full px-6 pt-6 space-y-6"
        >
          <TestchartsHeader 
            onAddNew={() => navigate('/assets/testcharts/new')} 
            onResetView={handleResetView}
          />
          <div className="flex-1 flex min-h-0 space-x-4">
            <motion.div 
              layout 
              className="flex-1 flex flex-col bg-white border border-border rounded-lg overflow-hidden"
              transition={{ duration: 0.3, type: 'spring' }}
            >
              <TestchartsTableToolbar
                numSelected={numSelected}
                onDelete={handleDelete}
                onEdit={handleEdit}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
              />
              <ScrollArea className="flex-1">
                {testchartsLoading ? (
                  <div className="p-4 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : testchartsError ? (
                  <div className="text-center py-12 text-red-500">{testchartsError.message}</div>
                ) : (
                  <HierarchicalTestchartsView
                    testcharts={filteredTestcharts || []}
                    selectedItems={selectedItems}
                    setSelectedItems={setSelectedItems}
                    onRowClick={handleRowClick}
                    activeId={activeAsset?.id}
                    onPatchSetClick={handlePatchSetClick}
                  />
                )}
              </ScrollArea>
            </motion.div>
            <AnimatePresence>
              {activeAsset && (
                <GenericDetailPane
                  asset={activeAsset}
                  onClose={closePane}
                  onViewDetails={handleViewDetails}
                  assetType={activeAsset.assetType}
                  activeDataMode={null}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </>
  );
};

export default Testcharts;