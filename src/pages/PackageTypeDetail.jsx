import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Breadcrumb from '@/components/Breadcrumb';
import LayerConfiguration from '@/components/packagetypes/LayerConfiguration';

const packageTypesData = [
    {
      id: 'pt2',
      name: 'Shrink Sleeve',
      baseSubstrate: 'PETG',
      baseCoat: 'N/A',
      laminate: 'N/A',
      topCoat: 'Matte Varnish',
      surfaceReverse: 'Reverse',
      description: 'A high-shrinkage sleeve that conforms to unique container shapes, offering 360-degree branding. The matte varnish provides a modern, tactile feel.',
    },
    {
      id: 'pt3',
      name: 'Corrugated Box',
      baseSubstrate: 'Kraft Liner',
      baseCoat: 'Clay Coat',
      laminate: 'N/A',
      topCoat: 'N/A',
      surfaceReverse: 'Surface',
      description: 'Durable corrugated box for shipping and retail. The clay-coated surface provides a smooth, printable canvas for vibrant graphics.',
    },
    {
      id: 'pt4',
      name: 'Folding Carton',
      baseSubstrate: 'SBS',
      baseCoat: 'Primer',
      laminate: 'Soft Touch',
      topCoat: 'Aqueous',
      surfaceReverse: 'Surface',
      description: 'Premium folding carton made from Solid Bleached Sulfate (SBS) board. Features a luxurious soft-touch laminate and a protective aqueous top coat.',
    },
  ];

const PackageTypeDetail = () => {
  const { packageTypeId } = useParams();
  const packageType = packageTypesData.find(pt => pt.id === packageTypeId);

  if (!packageType) {
    return <Navigate to="/assets/package-types" replace />;
  }

  return (
    <>
      <Helmet>
        <title>{packageType.name} - Package Type Details</title>
        <meta name="description" content={`Details for ${packageType.name}.`} />
      </Helmet>
      <motion.div
        className="flex flex-col h-full px-6 pt-6 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Breadcrumb />
        <main className="flex-grow space-y-6">
          <LayerConfiguration packageType={packageType} />
        </main>
      </motion.div>
    </>
  );
};

export default PackageTypeDetail;