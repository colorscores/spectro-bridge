import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const StructureRow = ({ structure, isActive, onRowClick }) => {
  const navigate = useNavigate();

  const handleRowClick = () => {
    onRowClick(structure.id);
  };

  const handleDoubleClick = () => {
    navigate(`/assets/structures/${structure.id}`);
  };

  return (
    <TableRow
      className={cn(
        "cursor-pointer",
        isActive ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-100"
      )}
      onClick={handleRowClick}
      onDoubleClick={handleDoubleClick}
    >
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{structure.name}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{structure.baseSubstrate}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{structure.baseCoat}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{structure.laminate}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{structure.topCoat}</TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{structure.surfaceReverse}</TableCell>
    </TableRow>
  );
};

export default StructureRow;