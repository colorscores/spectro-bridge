import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X } from 'lucide-react';

const SeparationsTable = ({ separations, selectedSeparation, onSeparationSelect, isCompacted }) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Separations</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Separation Name</TableHead>
              {!isCompacted && (
                <>
                  <TableHead className="text-center">CMYK Inks</TableHead>
                  <TableHead className="text-center">TAC</TableHead>
                  <TableHead className="text-center">Extended Inks</TableHead>
                  <TableHead className="text-center">Spot Inks</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {separations.map((separation) => (
              <TableRow
                key={separation.id}
                className={`cursor-pointer transition-colors ${
                  selectedSeparation?.id === separation.id
                    ? 'bg-primary/10 border-primary'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => onSeparationSelect(separation)}
              >
                <TableCell className="font-medium">{separation.name}</TableCell>
                {!isCompacted && (
                  <>
                    <TableCell className="text-center">
                      {separation.cmykInks ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">{separation.tac}%</TableCell>
                    <TableCell className="text-center">
                      {separation.extendedInks ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {separation.spotInks ? (
                        <Check className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SeparationsTable;