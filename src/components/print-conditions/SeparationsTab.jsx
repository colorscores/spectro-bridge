import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SeparationsTable from './SeparationsTable';
import SeparationsFlyout from './SeparationsFlyout';

const SeparationsTab = ({ condition }) => {
  const [selectedSeparation, setSelectedSeparation] = useState(null);

  // Mock separations data
  const separations = [
    {
      id: 1,
      name: 'CMYK Standard',
      cmykInks: true,
      tac: 320,
      extendedInks: false,
      spotInks: false,
    },
    {
      id: 2,
      name: 'CMYK + OGV',
      cmykInks: true,
      tac: 350,
      extendedInks: true,
      spotInks: false,
    },
    {
      id: 3,
      name: 'CMYK + Spot',
      cmykInks: true,
      tac: 280,
      extendedInks: false,
      spotInks: true,
    },
  ];

  const handleSeparationSelect = (separation) => {
    setSelectedSeparation(separation);
  };

  const handleCloseFlyout = () => {
    setSelectedSeparation(null);
  };

  return (
    <div className="flex gap-4 h-full">
      <div className={`transition-all duration-300 ${selectedSeparation ? 'w-80' : 'flex-1'}`}>
        <SeparationsTable
          separations={separations}
          selectedSeparation={selectedSeparation}
          onSeparationSelect={handleSeparationSelect}
          isCompacted={!!selectedSeparation}
        />
      </div>
      
      {selectedSeparation && (
        <div className="flex-1">
          <SeparationsFlyout
            separation={selectedSeparation}
            onClose={handleCloseFlyout}
          />
        </div>
      )}
    </div>
  );
};

export default SeparationsTab;