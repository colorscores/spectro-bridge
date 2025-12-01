import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Breadcrumb from '@/components/Breadcrumb';
import StructuresTable from '@/components/structures/StructuresTable';

const Structures = () => {
  const [activeStructureId, setActiveStructureId] = useState(null);

  const structuresData = [
    {
      id: 'pt2',
      name: 'Shrink Sleeve',
      baseSubstrate: 'PETG',
      baseCoat: 'N/A',
      laminate: 'N/A',
      topCoat: 'Matte Varnish',
      surfaceReverse: 'Reverse',
    },
    {
      id: 'pt3',
      name: 'Corrugated Box',
      baseSubstrate: 'Kraft Liner',
      baseCoat: 'Clay Coat',
      laminate: 'N/A',
      topCoat: 'N/A',
      surfaceReverse: 'Surface',
    },
    {
      id: 'pt4',
      name: 'Folding Carton',
      baseSubstrate: 'SBS',
      baseCoat: 'Primer',
      laminate: 'Soft Touch',
      topCoat: 'Aqueous',
      surfaceReverse: 'Surface',
    },
  ];

  const handleRowClick = (structureId) => {
    setActiveStructureId(prevId => (prevId === structureId ? null : structureId));
  };

  return (
    <>
      <Helmet>
        <title>Structures - App</title>
        <meta name="description" content="Manage structures for your brand." />
      </Helmet>
      <motion.div 
        className="flex flex-col h-full px-6 pt-6 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Breadcrumb />
        <main className="flex-grow">
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <StructuresTable 
              structures={structuresData}
              activeStructureId={activeStructureId}
              onRowClick={handleRowClick}
            />
          </div>
        </main>
      </motion.div>
    </>
  );
};

export default Structures;