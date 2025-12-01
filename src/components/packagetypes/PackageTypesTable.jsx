import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from '@/components/ui/table';
import PackageTypeRow from '@/components/packagetypes/PackageTypeRow';

const PackageTypesTable = ({ packageTypes }) => {
  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="w-[25%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</TableHead>
            <TableHead className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Substrate</TableHead>
            <TableHead className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Coat</TableHead>
            <TableHead className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Laminate</TableHead>
            <TableHead className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top Coat</TableHead>
            <TableHead className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Surface/Reverse</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packageTypes.map((packageType) => (
            <PackageTypeRow key={packageType.id} packageType={packageType} />
          ))}
        </TableBody>
      </Table>
      {packageTypes.length === 0 && (
         <div className="text-center py-12">
            <p className="text-gray-500">No package types found.</p>
         </div>
      )}
    </div>
  );
};

export default PackageTypesTable;