import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const PackageTypesHeader = () => {
  return (
    <header className="bg-white border-b border-gray-200 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Package Types</h1>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Package Type
          </Button>
        </div>
      </div>
    </header>
  );
};

export default PackageTypesHeader;