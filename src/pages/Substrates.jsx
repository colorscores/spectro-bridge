import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubstratesData } from '@/context/SubstrateContext';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import SubstratesHeader from '@/components/substrates/SubstratesHeader';
import SubstratesTableToolbar from '@/components/substrates/SubstratesTableToolbar';
import SubstratesTable from '@/components/substrates/SubstratesTable';
import SubstrateDetailPane from '@/components/substrates/SubstrateDetailPane';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Substrates = () => {
    const { substrates, loading: substratesLoading, error: substratesError, refetch: refetchSubstrates } = useSubstratesData();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('list');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [activeId, setActiveId] = useState(null);
    const [openSubstrates, setOpenSubstrates] = useState(new Set());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    
    const navigate = useNavigate();

    // Ensure data loads when navigating directly to this page
    useEffect(() => {
      try { refetchSubstrates?.(); } catch {}
    }, []);

    // Avoid duplicate refetch; context fetches on profile ready

    // Do not auto-expand all; keep collapsed by default for performance
    useEffect(() => {
      if (substrates.length > 0) {
        setOpenSubstrates(new Set());
      }
    }, [substrates]);

    const filteredSubstrates = useMemo(() => {
        if (!substrates) return [];
        return substrates.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [substrates, searchTerm]);

    const allIds = useMemo(() => {
        if (!filteredSubstrates) return [];
        return filteredSubstrates.flatMap(s => [s.id, ...(s.conditions || []).map(c => c.id)]);
    }, [filteredSubstrates]);

    const activeItem = useMemo(() => {
        if (!activeId || !substrates) return null;
        for (const substrate of substrates) {
            if (substrate.id === activeId) return substrate;
            const condition = substrate.conditions?.find(c => c.id === activeId);
            if (condition) return { ...condition, substrate_id: substrate.id };
        }
        return null;
    }, [activeId, substrates]);
    
    const handleRowClick = useCallback((item) => {
        setActiveId(prev => prev === item.id ? null : item.id);
    }, []);

    const onSelectAll = useCallback((checked) => {
        setSelectedIds(checked ? new Set(allIds || []) : new Set());
    }, [allIds]);

    const onSelectSubstrate = useCallback((substrate, checked) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            const childIds = (substrate.conditions || []).map(c => c.id);
            if (checked) {
                newSet.add(substrate.id);
                childIds.forEach(id => newSet.add(id));
            } else {
                newSet.delete(substrate.id);
                childIds.forEach(id => newSet.delete(id));
            }
            return newSet;
        });
    }, []);

    const onSelectCondition = useCallback((condition, checked) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(condition.id);
            } else {
                newSet.delete(condition.id);
            }
            return newSet;
        });
    }, []);
    
    const getSubstrateSelectionState = useCallback((substrate) => {
        const conditionIds = (substrate.conditions || []).map(c => c.id);
        const allChildIds = [substrate.id, ...conditionIds];
        const selectedCount = allChildIds.filter(id => selectedIds.has(id)).length;
        if (selectedCount === 0) return 'unchecked';
        if (selectedCount === allChildIds.length) return 'checked';
        return 'indeterminate';
    }, [selectedIds]);

    const toggleSubstrate = useCallback((substrateId) => {
        setOpenSubstrates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(substrateId)) newSet.delete(substrateId);
            else newSet.add(substrateId);
            return newSet;
        });
    }, []);
    
    const handleDelete = async () => {
        const selectedSubstrateIds = Array.from(selectedIds).filter(id => substrates.some(s => s.id === id));
        const selectedConditionIds = Array.from(selectedIds).filter(id => !selectedSubstrateIds.includes(id));
        
        try {
            if (selectedConditionIds.length > 0) {
                const { error: condError } = await supabase.from('substrate_conditions').delete().in('id', selectedConditionIds);
                if (condError) throw condError;
            }
            if (selectedSubstrateIds.length > 0) {
                await supabase.from('substrate_conditions').delete().in('substrate_id', selectedSubstrateIds);
                const { error: subError } = await supabase.from('substrates').delete().in('id', selectedSubstrateIds);
                if (subError) throw subError;
            }
            
            toast({ title: 'Success', description: 'Selected items deleted.' });
            setSelectedIds(new Set());
            refetchSubstrates();
        } catch (error) {
            toast({ title: 'Error', description: `Failed to delete items: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsDeleteDialogOpen(false);
        }
    };
    
    const handleEditClick = () => {
        if (selectedIds.size !== 1) {
            toast({ title: 'Error', description: 'Please select exactly one item to edit.', variant: 'destructive' });
            return;
        }
        const idToEdit = [...selectedIds][0];
        const substrate = substrates.find(s => s.id === idToEdit);
        if (substrate) {
            navigate(`/assets/substrates/${idToEdit}`);
            return;
        }
        for (const sub of substrates) {
            const condition = sub.conditions?.find(c => c.id === idToEdit);
            if (condition) {
                navigate(`/assets/substrates/${sub.id}/conditions/${idToEdit}`);
                return;
            }
        }
        toast({ title: 'Error', description: 'Selected item not found.', variant: 'destructive' });
    };

    const handleNewSubstrate = () => {
      navigate('/assets/substrates/new');
    };

    const handleNewCondition = () => {
      const activeSubstrate = getActiveSubstrate();
      if (activeSubstrate) {
        navigate(`/assets/substrates/${activeSubstrate.id}/conditions/new`);
      }
    };

    const getActiveSubstrate = () => {
      // Check if activeId corresponds to a substrate (not a condition)
      if (!activeId) return null;
      
      const substrate = substrates.find(s => s.id === activeId);
      return substrate || null;
    };

    if (substratesError) {
        return <div className="p-4 text-red-500">Error loading substrates: {substratesError.message}</div>;
    }

    const renderSkeletons = () => (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );

    return (
        <>
            <Helmet>
                <title>Substrates - Spectral</title>
                <meta name="description" content="Manage and view your organization's substrates." />
            </Helmet>
            <div className="flex flex-col h-full px-6 pt-6 space-y-6">
              <SubstratesHeader 
                  onNewSubstrate={handleNewSubstrate} 
                  onNewCondition={handleNewCondition}
                  activeSubstrate={getActiveSubstrate()}
              />
              <div className="flex-1 flex min-h-0 min-w-0 gap-4">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  layout 
                  className="flex-1 flex flex-col bg-white border border-border rounded-lg overflow-hidden"
                >
                  <div className="pt-6 px-6">
                    <SubstratesTableToolbar
                      searchTerm={searchTerm}
                      onSearchTermChange={setSearchTerm}
                      viewMode={viewMode}
                      setViewMode={setViewMode}
                      numSelected={selectedIds.size}
                      onEditClick={handleEditClick}
                      onDeleteClick={() => setIsDeleteDialogOpen(true)}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden min-h-0">
                    <div className="overflow-auto h-full px-6 py-6">
                      {substratesLoading ? renderSkeletons() : (
                        <SubstratesTable
                          substrates={filteredSubstrates}
                          selectedIds={selectedIds}
                          activeId={activeId}
                          allIds={allIds || []}
                          openSubstrates={openSubstrates}
                          onSelectAll={onSelectAll}
                          onSelectSubstrate={onSelectSubstrate}
                          onSelectCondition={onSelectCondition}
                          getSubstrateSelectionState={getSubstrateSelectionState}
                          onRowClick={handleRowClick}
                          toggleSubstrate={toggleSubstrate}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
                <AnimatePresence>
                  {activeItem && (
                    <SubstrateDetailPane
                      item={activeItem}
                      onClose={() => setActiveId(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the selected substrates and all their associated conditions.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default Substrates;