
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debugUtils';
import { useInksData } from '@/context/InkContext';
import { useSubstratesData } from '@/context/SubstrateContext';
// Removed react-query utilities on this page to avoid dispatcher/context crashes
import InksHeader from '@/components/inks/InksHeader';
import InksTableToolbar from '@/components/inks/InksTableToolbar';
import InksTable from '@/components/inks/InksTable';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import GenericDetailPane from '@/components/assets/GenericDetailPane';
import AddInkBookDialog from '@/components/inks/AddInkBookDialog';
import AddToInkBookDialog from '@/components/inks/AddToInkBookDialog';
import RemoveFromInkBookDialog from '@/components/inks/RemoveFromInkBookDialog';
import DeleteInkBookDialog from '@/components/inks/DeleteInkBookDialog';
import MultiFormatExportDialog from '@/components/export/MultiFormatExportDialog';
import { useProfile } from '@/context/ProfileContext';
import { backfillInkConditionColors } from '@/utils/inkColorBackfill';
import { Button } from '@/components/ui/button';
import AdaptInkConditionWizard from '@/components/inks/AdaptInkConditionWizard';
import AdaptInkConditionWizardV2 from '@/components/inks/AdaptInkConditionWizardV2';
import ErrorBoundary from '@/components/ErrorBoundary';

const Inks = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { inkBooks, allInks, loading: inksLoading, error: inksError, refetch: refetchInks, forceRefresh, forceRefreshConditions, optimisticDeleteInk, optimisticDeleteInkCondition } = useInksData();
  const { profile } = useProfile();
  const { substrates } = useSubstratesData();
  
  // Ensure data loads when navigating directly to this page
  React.useEffect(() => {
    try { refetchInks?.(true); } catch {}
  }, []);
  
  // Helper function to get substrate condition color by ID
  const getSubstrateConditionColor = useCallback((substrateConditionId) => {
    if (!substrateConditionId || !substrates) return '#f5f5f5';
    
    for (const substrate of substrates) {
      if (substrate.conditions) {
        const condition = substrate.conditions.find(c => c.id === substrateConditionId);
        if (condition?.color_hex) {
          return condition.color_hex;
        }
      }
    }
    return '#f5f5f5';
  }, [substrates]);
  
  // Debug logging
  const [selectedItems, setSelectedItems] = useState({ books: new Set(), inks: new Set(), conditions: new Set() });
  const [view, setView] = useState('flat');
  const [activeAsset, setActiveAsset] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  
  const [dialogs, setDialogs] = useState({
    isAddBookOpen: false,
    isAddToBookOpen: false,
    isRemoveFromBookOpen: false,
    isDeleteBookOpen: false,
    isCxfExportOpen: false,
    isAdaptOpen: false,
  });

  const filteredInks = useMemo(() => {
    if (!allInks) {
      
      return [];
    }
    const filtered = allInks.filter(ink => 
      ink.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ink.conditions && ink.conditions.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())))
    );
    return filtered;
  }, [allInks, searchTerm]);

  const filteredInkBooks = useMemo(() => {
    if (view !== 'book' || !inkBooks) return [];
    if (!searchTerm) return inkBooks;

    return inkBooks.map(book => {
      const matchingInks = (book.inks || []).filter(ink => 
        ink.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ink.conditions && ink.conditions.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      return { ...book, inks: matchingInks };
    }).filter(book => book.inks.length > 0);
  }, [inkBooks, searchTerm, view]);

  const numSelected = useMemo(() => {
    return selectedItems.inks.size + selectedItems.conditions.size;
  }, [selectedItems]);

  const handleRowClick = (item) => {
    if (activeAsset && activeAsset.id === item.id) {
      setActiveAsset(null);
    } else {
      setActiveAsset(item);
    }
  };

  const closePane = () => {
    setActiveAsset(null);
  };

  const handleDelete = async () => {
    const inkIdsToDelete = Array.from(selectedItems.inks);
    const conditionIdsToDelete = Array.from(selectedItems.conditions);

    debug.log('🗑️ handleDelete called with:', { 
      inkIdsToDelete, 
      conditionIdsToDelete,
      selectedItems: {
        inks: Array.from(selectedItems.inks),
        conditions: Array.from(selectedItems.conditions),
        books: Array.from(selectedItems.books)
      }
    });

    if (inkIdsToDelete.length === 0 && conditionIdsToDelete.length === 0) {
        debug.log('❌ No items selected for deletion');
        toast.error("No items selected for deletion.");
        return;
    }

    try {
        // Apply optimistic updates for immediate UI feedback for current user
        // Real-time subscriptions will handle updates from other users
        if (inkIdsToDelete.length > 0) {
            inkIdsToDelete.forEach(inkId => {
                debug.log('Applying optimistic delete for current user, ink:', inkId);
                optimisticDeleteInk(inkId);
            });
        }

        if (conditionIdsToDelete.length > 0) {
            // Find which ink each condition belongs to for optimistic updates
            conditionIdsToDelete.forEach(conditionId => {
                const inkWithCondition = allInks.find(ink => 
                    ink.conditions && ink.conditions.some(condition => condition.id === conditionId)
                );
                if (inkWithCondition) {
                    debug.log('Applying optimistic delete for current user, condition:', conditionId, 'from ink:', inkWithCondition.id);
                    optimisticDeleteInkCondition(inkWithCondition.id, conditionId);
                }
            });
        }

        // Clear selections immediately for better UX
        setSelectedItems({ books: new Set(), inks: new Set(), conditions: new Set() });

        // Respect foreign key constraints: detach dependents, then delete
        // 1) Detach colors that reference these ink conditions
        if (conditionIdsToDelete.length > 0) {
          debug.log('Step 1: Detaching colors from ink conditions:', conditionIdsToDelete);
          const { error: detachError } = await supabase
            .from('colors')
            .update({ from_ink_condition_id: null })
            .in('from_ink_condition_id', conditionIdsToDelete)
            .eq('organization_id', profile?.organization_id || '');
          if (detachError) {
            console.error('Failed to detach colors:', detachError);
            refetchInks();
            throw detachError;
          }
        }

        // 2) Remove approvals tied to these conditions (if any)
        if (conditionIdsToDelete.length > 0) {
          debug.log('Step 2: Deleting ink_condition_color_approvals for:', conditionIdsToDelete);
          const { error: approvalsError } = await supabase
            .from('ink_condition_color_approvals')
            .delete()
            .in('ink_condition_id', conditionIdsToDelete);
          if (approvalsError) {
            console.warn('Approvals delete warning (non-fatal):', approvalsError);
          }
        }

        // 3) Remove book associations for selected inks (if any)
        if (inkIdsToDelete.length > 0) {
          debug.log('Step 3: Deleting ink_book_associations for inks:', inkIdsToDelete);
          const { error: assocError } = await supabase
            .from('ink_book_associations')
            .delete()
            .in('ink_id', inkIdsToDelete)
            .eq('organization_id', profile?.organization_id || '');
          if (assocError) {
            console.warn('Associations delete warning (non-fatal):', assocError);
          }
        }

        // 4) Delete ink conditions
        if (conditionIdsToDelete.length > 0) {
          debug.log('Step 4: Deleting ink_conditions:', conditionIdsToDelete);
          const { error: condDelError } = await supabase
            .from('ink_conditions')
            .delete()
            .in('id', conditionIdsToDelete);
          if (condDelError) {
            console.error('Ink conditions delete failed:', condDelError);
            refetchInks();
            throw condDelError;
          }
        }

        // 5) Delete inks
        if (inkIdsToDelete.length > 0) {
          debug.log('Step 5: Deleting inks:', inkIdsToDelete);
          const { error: inksDelError } = await supabase
            .from('inks')
            .delete()
            .in('id', inkIdsToDelete);
          if (inksDelError) {
            console.error('Inks delete failed:', inksDelError);
            refetchInks();
            throw inksDelError;
          }
        }

        debug.log('Deletion successful - current user saw optimistic update, all users will see real-time confirmation');
        toast.success('Selected items deleted successfully.');
    } catch (error) {
        console.error('handleDelete error:', error);
        toast.error(`Failed to delete items: ${error.message}`);
        // Refresh on error to ensure UI is in sync
        refetchInks();
    }
  };

  const handleEdit = () => {
    const totalSelected = selectedItems.inks.size + selectedItems.conditions.size;
    if (totalSelected !== 1) {
        toast.error("Please select a single ink or condition to edit.");
        return;
    }

    if (selectedItems.inks.size === 1) {
      const inkId = selectedItems.inks.values().next().value;
      navigate(`/assets/inks/${inkId}`);
    } else if (selectedItems.conditions.size === 1) {
      const conditionId = selectedItems.conditions.values().next().value;
      for (const ink of allInks) {
        const condition = (ink.conditions || []).find(c => c.id === conditionId);
        if (condition) {
          navigate(`/assets/inks/${ink.id}/conditions/${condition.id}`);
          return;
        }
      }
    }
  };

  const handleAdapt = () => {
    const totalSelected = selectedItems.inks.size + selectedItems.conditions.size;
    if (selectedItems.conditions.size !== 1) {
      toast.error("Please select exactly one ink condition to adapt.");
      return;
    }
    
    handleOpenDialog('isAdaptOpen');
  };

  const getSelectedInkCondition = () => {
    if (selectedItems.conditions.size !== 1) return null;
    
    const conditionId = selectedItems.conditions.values().next().value;
    for (const ink of allInks || []) {
      const condition = (ink.conditions || []).find(c => c.id === conditionId);
      if (condition) {
        return { ...condition, ink_id: ink.id };
      }
    }
    return null;
  };


  // Real-time subscriptions are handled by InkContext, no need for duplicate subscriptions
  // Removed duplicate subscription logic to prevent conflicts

  useEffect(() => {
    setSelectedItems({ books: new Set(), inks: new Set(), conditions: new Set() });
    setActiveAsset(null);
  }, [view]);

  // Handle navigation state for new ink creation
  useEffect(() => {
    if (location.state?.newInkId) {
      // Force refresh to ensure new ink is visible
      forceRefresh();
      
      // Clear the navigation state to prevent repeated refreshes
      navigate(location.pathname, { replace: true });
    }
  }, [location.state?.newInkId, forceRefresh, navigate, location.pathname]);

  // Keep the flyout asset in sync with latest data after saves/refetches
  useEffect(() => {
    if (!activeAsset) return;
    if (activeAsset.assetType === 'Ink') {
      const updated = allInks?.find(i => i.id === activeAsset.id);
      if (updated) {
        setActiveAsset(prev => ({ ...updated, assetType: 'Ink' }));
      }
    } else if (activeAsset.assetType === 'Ink Condition') {
      let found = null;
      for (const ink of allInks || []) {
        const cond = (ink.conditions || []).find(c => c.id === activeAsset.id);
        if (cond) { found = { ...cond, assetType: 'Ink Condition', parentId: ink.id }; break; }
      }
      if (found) {
        setActiveAsset(found);
      }
    }
  }, [allInks]);

  const handleViewDetails = (item) => {
    if (item.assetType === 'Ink') {
      navigate(`/assets/inks/${item.id}`);
    } else if (item.assetType === 'Ink Condition') {
      navigate(`/assets/inks/${item.parentId}/conditions/${item.id}`);
    }
  };

  const handleOpenDialog = (dialogName) => {
    setDialogs(prev => ({ ...prev, [dialogName]: true }));
  };

  const handleDataChanged = useCallback(() => {
    debug.log('🔄 Inks: Data changed, forcing refresh of conditions (no React Query invalidation)');
    forceRefreshConditions();
    refetchInks?.();
    setSelectedItems({ books: new Set(), inks: new Set(), conditions: new Set() });
  }, [forceRefreshConditions, refetchInks]);

  const handleAddToBookClick = () => {
    const inkIds = Array.from(selectedItems.inks);
    if (inkIds.length === 0) {
      toast.error("Please select at least one ink to add to a book.");
      return;
    }
    handleOpenDialog('isAddToBookOpen');
  };

  const handleRemoveFromBookClick = () => {
    if (selectedItems.inks.size === 0) {
      toast.error("No inks selected. Please select inks to remove from books.");
      return;
    }
    
    // Check if all selected items are inks in books (have associationId)
    const hasInvalidSelection = Array.from(selectedItems.inks).some(id => !id.includes('::'));
    if (hasInvalidSelection) {
      toast.error("You can only remove inks that are inside a book. Please select inks from the book view.");
      return;
    }
    
    setDialogs(prev => ({...prev, isRemoveFromBookOpen: true}));
  };
  
  const handleDeleteBookClick = () => {
    if (selectedItems.books.size > 0) {
       handleOpenDialog('isDeleteBookOpen');
    } else {
      toast.error("No books selected. Please select at least one book to delete.");
    }
  };

  const handleExportClick = () => {
    const totalSelected = numSelected;
    if (totalSelected === 0) {
      toast.error("Please select at least one ink or ink condition to export.");
      return;
    }
    setDialogs(prev => ({ ...prev, isCxfExportOpen: true }));
  };

  const getExportReferences = () => {
    const references = [];
    const addedConditionIds = new Set();

    // Process selected inks (export all their conditions if no conditions are directly selected for that ink)
    Array.from(selectedItems.inks).forEach(inkId => {
      const ink = allInks.find(i => i.id === inkId);
      if (ink && ink.conditions) {
        // Check if any conditions of this ink are also selected
        const hasSelectedConditions = ink.conditions.some(condition => 
          selectedItems.conditions.has(condition.id)
        );
        
        // If no conditions are selected for this ink, add all conditions
        if (!hasSelectedConditions) {
          ink.conditions.forEach(condition => {
            if (!addedConditionIds.has(condition.id)) {
              references.push({
                color_id: condition.color_id,
                name: `${ink.name} - ${condition.name}`,
                lab: condition.lab,
                from_ink_condition_id: condition.id
              });
              addedConditionIds.add(condition.id);
            }
          });
        }
      }
    });

    // Process selected conditions directly
    Array.from(selectedItems.conditions).forEach(conditionId => {
      if (!addedConditionIds.has(conditionId)) {
        const ink = allInks.find(i => i.conditions?.some(c => c.id === conditionId));
        const condition = ink?.conditions?.find(c => c.id === conditionId);
        
        if (ink && condition) {
          references.push({
            color_id: condition.color_id,
            name: `${ink.name} - ${condition.name}`,
            lab: condition.lab,
            from_ink_condition_id: condition.id
          });
          addedConditionIds.add(condition.id);
        }
      }
    });

    return references;
  };

  // Debug function to backfill missing color_hex values
  const handleBackfillColors = async () => {
    if (!profile?.organization_id) {
      toast.error('Missing organization');
      return;
    }

    try {
      // Fetch minimal ASTM tables on demand
      const { data: astmTables, error: astmErr } = await supabase
        .from('astm_e308_tables')
        .select('*')
        .eq('table_number', 5)
        .eq('illuminant_name', 'D50')
        .eq('observer', '2');
      if (astmErr) throw astmErr;

      // Get organization defaults
      const { data: orgDefaults } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (!orgDefaults) {
        toast.error('Failed to get organization defaults');
        return;
      }

      console.log('🔄 Starting color backfill process...');
      const updatedCount = await backfillInkConditionColors(
        profile.organization_id,
        orgDefaults,
        astmTables || []
      );

      if (updatedCount > 0) {
        toast.success(`Updated ${updatedCount} ink condition colors`);
        // Refresh the data
        forceRefresh();
      } else {
        toast.success('All ink condition colors are already up to date');
      }
    } catch (error) {
      console.error('Failed to backfill colors:', error);
      toast.error('Failed to update ink condition colors');
    }
  };


  return (
    <>
      <Helmet>
        <title>Inks — Manage inks and conditions</title>
        <meta name="description" content="Manage inks, ink books, and print conditions for your organization." />
        <link rel="canonical" href="/assets/inks" />
      </Helmet>
      <div className="flex flex-col h-full px-6 pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Inks</h1>
          <InksHeader 
            onAddNew={() => navigate('/assets/inks/new')} 
            onAddBook={() => handleOpenDialog('isAddBookOpen')}
            currentView={view}
          />
        </div>
        <div className="flex-1 flex min-h-0 min-w-0 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            layout 
            className="flex-1 flex flex-col bg-white border border-border rounded-lg min-h-0 min-w-0"
          >
            <div className="flex-none pt-6 space-y-6">
              <div className="px-6">
                <InksTableToolbar
                  selectedItems={selectedItems}
                  numSelected={numSelected}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onAdapt={handleAdapt}
                  currentView={view}
                  onViewChange={setView}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  onAddToBookClick={handleAddToBookClick}
                  onRemoveFromBookClick={handleRemoveFromBookClick}
                  onDeleteBookClick={handleDeleteBookClick}
                  onExportClick={handleExportClick}
                />
              </div>
            </div>
            <ErrorBoundary fallbackMessage="Error loading inks table. Please refresh the page.">
              <div className="flex-1 min-h-0 overflow-hidden">
                <div className="overflow-auto h-full">
                  {inksLoading ? (
                    <div className="p-4 space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : inksError ? (
                    <div className="text-center py-12 text-red-500">{inksError.message}</div>
                  ) : (
                    <InksTable
                      view={view}
                      inks={filteredInks || []}
                      inkBooks={filteredInkBooks || []}
                      selectedItems={selectedItems}
                      setSelectedItems={setSelectedItems}
                      onRowClick={handleRowClick}
                      activeId={activeAsset?.id}
                      getSubstrateConditionColor={getSubstrateConditionColor}
                    />
                  )}
                </div>
              </div>
            </ErrorBoundary>
          </motion.div>
          <AnimatePresence>
            {activeAsset && (
              <ErrorBoundary fallbackMessage="Error loading ink details. Please close and reopen the detail panel.">
                <GenericDetailPane
                  asset={activeAsset}
                  onClose={closePane}
                  onViewDetails={handleViewDetails}
                  assetType={activeAsset.assetType}
                  
                />
              </ErrorBoundary>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Dialogs */}
      <AddInkBookDialog
        isOpen={dialogs.isAddBookOpen}
        setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isAddBookOpen: isOpen }))}
        onBookAdded={handleDataChanged}
      />
      <AddToInkBookDialog
        isOpen={dialogs.isAddToBookOpen}
        setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isAddToBookOpen: isOpen }))}
        selectedInkIds={Array.from(selectedItems.inks)}
        onSuccess={handleDataChanged}
        inkBooks={inkBooks}
      />
      <RemoveFromInkBookDialog
        isOpen={dialogs.isRemoveFromBookOpen}
        setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isRemoveFromBookOpen: isOpen }))}
        context={{ selectedAssetIds: selectedItems.inks }}
        onSuccess={handleDataChanged}
      />
      <DeleteInkBookDialog
        isOpen={dialogs.isDeleteBookOpen}
        setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isDeleteBookOpen: isOpen }))}
        selectedBookIds={Array.from(selectedItems.books)}
        onBooksDeleted={handleDataChanged}
      />
      <MultiFormatExportDialog
        isOpen={dialogs.isCxfExportOpen}
        setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isCxfExportOpen: isOpen }))}
        references={getExportReferences()}
        measurementsByColorId={{}}
        inkConditionsData={getExportReferences().filter(r => r.from_ink_condition_id).map(r => ({ 
          name: r.name, 
          from_ink_condition_id: r.from_ink_condition_id 
        }))}
        title="Export Selected Inks"
      />

      {dialogs.isAdaptOpen && getSelectedInkCondition() && (
        <AdaptInkConditionWizardV2
          isOpen={true}
          onClose={() => setDialogs(prev => ({ ...prev, isAdaptOpen: false }))}
          sourceInkCondition={getSelectedInkCondition()}
          onSuccess={handleDataChanged}
        />
      )}
    </>
  );
};

export default Inks;
