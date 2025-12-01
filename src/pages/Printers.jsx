import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PrintersHeader from '@/components/printers/PrintersHeader';
import PrintersTableToolbar from '@/components/printers/PrintersTableToolbar';
import PrintersTable from '@/components/printers/PrintersTable';
import PrintersFilterPane from '@/components/printers/PrintersFilterPane';
import GenericDetailPane from '@/components/assets/GenericDetailPane';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { usePrinterData } from '@/context/PrinterContext';

const Printers = () => {
  console.log('🔍 Printers component rendering with new functionality');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { printers, loading: printersLoading, error: printersError } = usePrinterData();
  const [selectedItems, setSelectedItems] = useState({ printers: new Set(), conditions: new Set() });
  const [activeAssetId, setActiveAssetId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterRows, setFilterRows] = useState([]);
  const [expandedPrinters, setExpandedPrinters] = useState(new Set());

  // Generate filter options from printers data
  const substrateOptions = useMemo(() => {
    const substrates = new Set();
    printers.forEach(printer => {
      printer.conditions?.forEach(condition => {
        if (condition.substrate_name) {
          const label = condition.substrate_condition ? 
            `${condition.substrate_name} - ${condition.substrate_condition}` : 
            condition.substrate_name;
          substrates.add(JSON.stringify({ value: condition.substrate_name, label }));
        }
      });
    });
    return Array.from(substrates).map(item => JSON.parse(item));
  }, [printers]);

  // Initialize filters from URL params and expand all printers if calibration filter is active
  useEffect(() => {
    const calibration = searchParams.get('calibration');
    if (calibration === 'uncalibrated') {
      setFilterRows([{
        id: 'init-calibration-filter',
        property: 'calibrationStatus',
        value: 'uncalibrated'
      }]);
      
      // Expand all printers when coming from calibrate action
      if (printers.length > 0) {
        const allPrinterIds = new Set(printers.map(printer => printer.id));
        setExpandedPrinters(allPrinterIds);
      }
    }
  }, [searchParams, printers]);

  const filteredPrinters = useMemo(() => {
    let filtered = printers;

    // Apply search term
    if (searchTerm) {
      filtered = filtered.map(printer => ({
        ...printer,
        conditions: printer.conditions?.filter(condition => 
          printer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          condition.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(printer => 
        printer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (printer.conditions && printer.conditions.length > 0)
      );
    }

    // Apply filters
    if (filterRows.length > 0) {
      filtered = filtered.map(printer => ({
        ...printer,
        conditions: printer.conditions?.filter(condition => {
          return filterRows.every(filter => {
            switch (filter.property) {
              case 'substrate':
                return !filter.value?.length || filter.value.includes(condition.substrate_name);
              case 'inkCount':
                const count = condition.inks?.length || 0;
                const min = filter.value?.min ? parseInt(filter.value.min) : 0;
                const max = filter.value?.max ? parseInt(filter.value.max) : Infinity;
                return count >= min && count <= max;
              case 'calibrationStatus':
                const isCalibrated = condition.calibration?.status === 'complete';
                return filter.value === 'calibrated' ? isCalibrated : !isCalibrated;
              default:
                return true;
            }
          });
        })
      })).filter(printer => !printer.conditions || printer.conditions.length > 0);
    }

    return filtered;
  }, [printers, searchTerm, filterRows]);
  
  const selectedAssetForPane = useMemo(() => {
    // Check if it's a printer
    const printer = printers.find(p => p.id === activeAssetId);
    if (printer) return { ...printer, assetType: 'Printer' };
    
    // Check if it's a condition
    for (const printer of printers) {
      const condition = printer.conditions?.find(c => c.id === activeAssetId);
      if (condition) return { ...condition, assetType: 'Printer Condition', parentId: printer.id };
    }
    return null;
  }, [printers, activeAssetId]);

  const numSelected = selectedItems.printers.size + selectedItems.conditions.size;
  const numConditionsSelected = selectedItems.conditions.size;
  const filterActive = filterRows.length > 0;

  const handleAssetRowClick = useCallback((asset) => {
    console.log('🔍 handleAssetRowClick called with asset:', asset);
    setActiveAssetId(prev => prev === asset.id ? null : asset.id);
  }, []);

  const handleDelete = () => {
    if (numSelected === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one printer or condition to delete.",
      });
      return;
    }
    
    toast({
      title: "🚧 Feature Not Implemented",
      description: "Delete functionality isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  const handleEdit = () => {
    if (numSelected !== 1) {
      toast({
        title: "Invalid selection",
        description: "Please select exactly one printer or condition to edit.",
      });
      return;
    }

    if (selectedItems.printers.size === 1) {
      const printerId = Array.from(selectedItems.printers)[0];
      navigate(`/assets/printers/${printerId}`);
    } else if (selectedItems.conditions.size === 1) {
      const conditionId = Array.from(selectedItems.conditions)[0];
      // Find the parent printer for this condition
      const printer = printers.find(p => p.conditions?.some(c => c.id === conditionId));
      if (printer) {
        navigate(`/assets/printers/${printer.id}/conditions/${conditionId}`);
      }
    }
  };

  const handleViewDetails = (item) => {
    console.log('🔍 handleViewDetails called with item:', item);
    if (item.assetType === 'Printer') {
      navigate(`/assets/printers/${item.id}`);
    } else if (item.assetType === 'Printer Condition') {
      navigate(`/assets/printers/${item.parentId}/conditions/${item.id}`);
    }
  };

  const handleCalibrateClick = () => {
    if (numConditionsSelected !== 1) {
      toast({
        title: "Invalid selection",
        description: "Please select exactly one printer condition to calibrate.",
      });
      return;
    }

    const selectedConditionId = Array.from(selectedItems.conditions)[0];
    const printer = printers.find(p => p.conditions?.some(c => c.id === selectedConditionId));
    if (printer) {
      navigate(`/assets/printers/${printer.id}/conditions/${selectedConditionId}?tab=calibration`);
    }
  };

  const handleFilterClick = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  const handleAddFilterRow = () => {
    setFilterRows(prev => [...prev, { 
      id: `filter_${Date.now()}`, 
      property: '', 
      value: null 
    }]);
  };

  const handleRemoveFilterRow = (id) => {
    setFilterRows(prev => prev.filter(row => row.id !== id));
  };

  const handleChangeFilterRow = (id, patch) => {
    setFilterRows(prev => prev.map(row => 
      row.id === id ? { ...row, ...patch } : row
    ));
  };

  const handleClearFilters = () => {
    setFilterRows([]);
    // Remove URL params
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('calibration');
    setSearchParams(newParams);
  };

  if (printersError) {
    return (
      <div className="p-4 text-red-500">
        Error loading printers: {printersError}
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Printers - Brand Asset Management</title>
        <meta name="description" content="Manage your company's printers." />
      </Helmet>
      <div className="flex-1 flex flex-col h-full px-6 pt-6 space-y-6">
        <PrintersHeader 
          numSelected={numSelected}
          onAddNew={() => navigate('/assets/printers/new')}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
        <div className="flex-1 flex min-h-0 space-x-4">
          <motion.div
            layout
            transition={{ duration: 0.3, type: 'spring' }}
            className="flex-1 flex flex-col bg-white border border-border rounded-lg overflow-hidden"
          >
             <PrintersTableToolbar
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                numSelected={numSelected}
                numConditionsSelected={numConditionsSelected}
                onEditClick={handleEdit}
                onDeleteClick={handleDelete}
                onFilterClick={handleFilterClick}
                onCalibrateClick={handleCalibrateClick}
                isFilterOpen={isFilterOpen}
                filterActive={filterActive}
              />
              <PrintersFilterPane
                open={isFilterOpen}
                rows={filterRows}
                onAddRow={handleAddFilterRow}
                onRemoveRow={handleRemoveFilterRow}
                onChangeRow={handleChangeFilterRow}
                onClear={handleClearFilters}
                substrateOptions={substrateOptions}
              />
            <ScrollArea className="flex-1">
              <PrintersTable
                printers={filteredPrinters}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                onRowClick={handleAssetRowClick}
                activeId={activeAssetId}
                expandedPrinters={expandedPrinters}
                setExpandedPrinters={setExpandedPrinters}
              />
            </ScrollArea>
          </motion.div>
          <AnimatePresence>
            {selectedAssetForPane && (
              <GenericDetailPane
                asset={selectedAssetForPane}
                onClose={() => setActiveAssetId(null)}
                onViewDetails={handleViewDetails}
                assetType={selectedAssetForPane.assetType}
                activeDataMode={null}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default Printers;