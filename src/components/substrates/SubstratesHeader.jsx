import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Plus } from 'lucide-react';

const SubstratesHeader = ({ onNewSubstrate, onNewCondition, activeSubstrate }) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Substrates
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {activeSubstrate && (
          <Button variant="outline" className="bg-white" onClick={onNewCondition}>
            <Plus className="mr-2 h-4 w-4" />
            Add Substrate Condition
          </Button>
        )}
        <Button onClick={onNewSubstrate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Substrate
        </Button>
      </div>
    </div>
  );
};

export default SubstratesHeader;