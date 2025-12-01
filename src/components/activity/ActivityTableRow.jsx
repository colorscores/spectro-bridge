import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const ActivityTableRow = ({ activity }) => {
  const isHighlighted = activity.activity === 'New Match Request Submitted';
  
  return (
    <TableRow 
      className={cn(
        "h-14 cursor-pointer group",
        isHighlighted ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
      )}
      data-state={isHighlighted ? 'selected' : undefined}
    >
      <TableCell className="p-4">
        <span className="font-medium text-gray-900">{activity.activity}</span>
      </TableCell>
      <TableCell className="p-4 text-gray-600">{activity.user}</TableCell>
      <TableCell className="p-4 text-gray-600">{activity.company}</TableCell>
      <TableCell className="p-4 text-gray-600">{activity.receiver}</TableCell>
      <TableCell className="p-4 text-gray-500">{activity.date}</TableCell>
    </TableRow>
  );
};

export default ActivityTableRow;