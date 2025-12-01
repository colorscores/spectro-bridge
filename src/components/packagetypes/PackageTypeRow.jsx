import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TableRow, TableCell } from '@/components/ui/table';

const PackageTypeRow = ({ packageType }) => {
  const navigate = useNavigate();

  const handleRowClick = () => {
    navigate(`/assets/package-types/${packageType.id}`);
  };

  return (
    <TableRow 
      className="hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
      onClick={handleRowClick}
    >
      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-md bg-gray-200 flex-shrink-0 mr-4 flex items-center justify-center">
            <img  alt="Package type thumbnail" src="https://images.unsplash.com/photo-1658204212985-e0126040f88f" />
          </div>
          <div className="font-medium text-gray-900">{packageType.name}</div>
        </div>
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{packageType.baseSubstrate}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{packageType.baseCoat}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{packageType.laminate}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{packageType.topCoat}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            packageType.surfaceReverse === 'Surface'
              ? 'bg-green-100 text-green-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {packageType.surfaceReverse}
        </span>
      </TableCell>
    </TableRow>
  );
};

export default PackageTypeRow;