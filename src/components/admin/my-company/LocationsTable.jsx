import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2 } from 'lucide-react';

const LocationsTable = ({ 
  locations, 
  loading, 
  onAddLocation, 
  onEditLocation, 
  onDeleteLocation,
  activeActionId,
  editing = false,
  onEditComplete,
}) => {
  return (
    <Card className="border-gray-200 flex flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold text-gray-600 w-1/4">Name</TableHead>
            <TableHead className="font-semibold text-gray-600 w-1/2">Address</TableHead>
            <TableHead className="font-semibold text-gray-600 w-1/4">City</TableHead>
            <TableHead className="text-right">
              <Button 
                variant="link" 
                size="sm" 
                className={`text-blue-600 font-semibold whitespace-nowrap transition-opacity ${
                  editing ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onAddLocation}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Location
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      <div className="overflow-y-auto">
        {loading ? (
          <div className="text-center text-gray-500 h-24 flex items-center justify-center">Loading...</div>
        ) : locations.length > 0 ? (
          <Table>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id} data-state={activeActionId === location.id ? 'selected-action' : ''} className="group h-[58px]">
                  <TableCell className="font-medium truncate pr-4 py-0">{location.name}</TableCell>
                  <TableCell className="truncate pr-4 py-0">{location.address}</TableCell>
                  <TableCell className="truncate pr-4 py-0">{location.city}</TableCell>
                  <TableCell className="text-right py-0">
                    <div className={`flex items-center justify-end space-x-1 transition-opacity ${
                      editing 
                        ? `opacity-0 group-hover:opacity-100 ${activeActionId === location.id ? 'opacity-100' : ''}`
                        : 'opacity-0 pointer-events-none'
                    }`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditLocation(location)}>
                        <Edit className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => onDeleteLocation(e, 'location', location.id)}>
                        <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-gray-500 h-24 flex items-center justify-center">No locations found.</div>
        )}
      </div>
    </Card>
  );
};

export default LocationsTable;