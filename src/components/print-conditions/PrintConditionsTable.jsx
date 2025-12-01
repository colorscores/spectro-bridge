import React from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import PrintConditionRow from './PrintConditionRow';

const PrintConditionsTable = ({ 
  conditions, 
  loading, 
  selectedConditions, 
  activeConditionId, 
  onSelectCondition, 
  onRowClick 
}) => {
  if (loading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[50px]">Color</TableHead>
              <TableHead style={{ width: 'calc(40% - 100px)' }}>Name</TableHead>
              <TableHead style={{ width: '20%' }}>Print Process</TableHead>
              <TableHead style={{ width: '20%' }}>Pack Type</TableHead>
              <TableHead className="text-right" style={{ width: '20%' }}>Last Edited</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, index) => (
              <TableRow key={index}>
                <TableHead><Skeleton className="h-4 w-4" /></TableHead>
                <TableHead><Skeleton className="h-8 w-8" /></TableHead>
                <TableHead><Skeleton className="h-8 w-8 rounded-md" /></TableHead>
                <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                <TableHead><Skeleton className="h-6 w-16" /></TableHead>
                <TableHead><Skeleton className="h-6 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="w-[50px]">Color</TableHead>
            <TableHead style={{ width: 'calc(40% - 100px)' }}>Name</TableHead>
            <TableHead style={{ width: '20%' }}>Print Process</TableHead>
            <TableHead style={{ width: '20%' }}>Pack Type</TableHead>
            <TableHead className="text-right" style={{ width: '20%' }}>Last Edited</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conditions.length === 0 ? (
            <TableRow>
              <TableHead colSpan={7} className="text-center py-8 text-gray-500">
                No print conditions found.
              </TableHead>
            </TableRow>
          ) : (
            conditions.map((condition) => (
              <PrintConditionRow
                key={condition.id}
                condition={condition}
                isSelected={selectedConditions.has(condition.id)}
                isActive={activeConditionId === condition.id}
                onSelect={(checked) => onSelectCondition(condition.id, checked)}
                onRowClick={() => onRowClick(condition)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default PrintConditionsTable;