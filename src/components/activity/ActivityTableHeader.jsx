import React from 'react';
import { TableHeader, TableHead, TableRow } from '@/components/ui/table';
import TableHeaderButton from '@/components/common/TableHeaderButton';

const ActivityTableHeader = ({ sortConfig, onSort }) => {
  const headers = [
    { key: 'activity', label: 'Activity' },
    { key: 'user', label: 'User' },
    { key: 'company', label: 'Company' },
    { key: 'receiver', label: 'Receiver' },
    { key: 'date', label: 'Date' }
  ];

  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {headers.map(header => (
          <TableHead key={header.key} className="px-4">
            <TableHeaderButton 
              onClick={() => onSort?.(header.key)}
              sortKey={header.key}
              currentSort={sortConfig}
              className="justify-start text-left"
            >
              {header.label}
            </TableHeaderButton>
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
};

export default ActivityTableHeader;