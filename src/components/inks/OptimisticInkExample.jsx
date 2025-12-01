import React from 'react';
import { Button } from '@/components/ui/button';
import { useInksData } from '@/context/InkContext';
import useInksQuery from '@/hooks/useInksQuery';
import { toast } from '@/hooks/use-toast';

/**
 * Example component demonstrating optimistic updates for ink creation
 * This shows how the system now provides immediate feedback across all related components
 */
const OptimisticInkExample = () => {
  const { allInks, inkBooks, optimisticAddInk } = useInksData();
  const { createInk, isCreating } = useInksQuery();
  

  const handleCreateExampleInk = async () => {
    try {
      const newInkData = {
        name: `Example Ink ${Date.now()}`,
        material: 'Offset',
        print_process: 'Sheet Fed',
        type: 'Standard',
        appearance_type: 'standard',
        conditions: [{
          id: `temp-condition-${Date.now()}`,
          name: 'Example Condition',
          displayName: 'Example Condition',
          color_hex: '#FF5733',
          ink_curve: 'as_measured',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]
      };

      // This will trigger optimistic updates - the ink will appear immediately in:
      // 1. The main inks list
      // 2. Any ink dropdowns
      // 3. The assets dashboard
      // 4. Any ink condition selectors
      await createInk(newInkData);

      toast({
        title: 'Success!',
        description: 'Ink created with optimistic updates - it appeared immediately everywhere!'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Optimistic Ink Creation Example</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This demonstrates how new inks appear immediately across all related components
        before the server confirms the creation.
      </p>
      <div className="mb-4">
        <p className="text-sm">Current inks count: {allInks.length}</p>
        <p className="text-sm">Current ink books count: {inkBooks.length}</p>
      </div>
      <Button 
        onClick={handleCreateExampleInk}
        disabled={isCreating}
      >
        {isCreating ? 'Creating...' : 'Create Example Ink (Optimistic)'}
      </Button>
    </div>
  );
};

export default OptimisticInkExample;