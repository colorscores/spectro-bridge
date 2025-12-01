import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, Search, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import PrintConditionsHeader from '@/components/print-conditions/PrintConditionsHeader';
import PrintConditionsTable from '@/components/print-conditions/PrintConditionsTable';
import PrintConditionsTableToolbar from '@/components/print-conditions/PrintConditionsTableToolbar';
import PrintConditionDetailPane from '@/components/print-conditions/PrintConditionDetailPane';

const PrintConditions = () => {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConditions, setSelectedConditions] = useState(new Set());
  const [activeCondition, setActiveCondition] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  

  useEffect(() => {
    fetchConditions();
    
    // Set up real-time subscription for new print conditions
    const channel = supabase
      .channel('print-conditions-changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'print_conditions' },
        (payload) => {
          console.log('New print condition created:', payload.new);
          // Add the new condition to the list
          setConditions(prev => [payload.new, ...prev]);
          toast({
            title: 'New print condition added',
            description: `${payload.new.name} was created successfully`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchConditions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('print_conditions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConditions(data || []);
    } catch (error) {
      console.error('Error fetching print conditions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load print conditions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (condition) => {
    navigate(`/print-conditions/${condition.id}`);
  };

  const handleSelectCondition = (conditionId, checked) => {
    setSelectedConditions(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(conditionId);
      } else {
        newSet.delete(conditionId);
      }
      return newSet;
    });
  };

  const handleDeleteConditions = async () => {
    if (selectedConditions.size === 0) return;
    
    try {
      const conditionIds = Array.from(selectedConditions);
      const { error } = await supabase
        .from('print_conditions')
        .delete()
        .in('id', conditionIds);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${conditionIds.length} print condition${conditionIds.length > 1 ? 's' : ''} deleted successfully`,
      });

      // Refresh the list and clear selections
      await fetchConditions();
      setSelectedConditions(new Set());
      
      // Close detail pane if the active condition was deleted
      if (activeCondition && conditionIds.includes(activeCondition.id)) {
        setActiveCondition(null);
      }
    } catch (error) {
      console.error('Error deleting print conditions:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete print conditions',
        variant: 'destructive',
      });
    }
  };

  const showToast = (event) => {
    event.stopPropagation();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  // Filter conditions based on search term
  const filteredConditions = useMemo(() => {
    if (!searchTerm) return conditions;
    
    const term = searchTerm.toLowerCase();
    return conditions.filter(condition => 
      condition.name?.toLowerCase().includes(term) ||
      condition.description?.toLowerCase().includes(term) ||
      condition.pack_type?.toLowerCase().includes(term) ||
      condition.print_process?.toLowerCase().includes(term)
    );
  }, [conditions, searchTerm]);

  const activeConditionId = useMemo(() => {
    return activeCondition?.id || null;
  }, [activeCondition]);

  return (
    <>
      <Helmet>
        <title>Print Conditions - Brand Asset Management</title>
        <meta name="description" content="Manage print conditions for your assets." />
      </Helmet>
      <div className="flex flex-col h-full px-6 pt-6 space-y-6">
        <PrintConditionsHeader />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex min-h-0 space-x-4"
        >
          <div className="flex-1 flex flex-col bg-white border border-border rounded-lg overflow-hidden">
            <PrintConditionsTableToolbar
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              numSelected={selectedConditions.size}
              onDeleteClick={handleDeleteConditions}
              onFilterClick={showToast}
            />
            
            {/* Table container */}
            <div className="flex-1 overflow-auto">
              <div className="p-6">
                <PrintConditionsTable
                  conditions={filteredConditions}
                  loading={loading}
                  selectedConditions={selectedConditions}
                  activeConditionId={activeConditionId}
                  onSelectCondition={handleSelectCondition}
                  onRowClick={handleRowClick}
                />
              </div>
            </div>
          </div>
          
          {activeCondition && (
            <PrintConditionDetailPane
              condition={activeCondition}
              onClose={() => setActiveCondition(null)}
            />
          )}
        </motion.div>
      </div>
    </>
  );
};

export default PrintConditions;