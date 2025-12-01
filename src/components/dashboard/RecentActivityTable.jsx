import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const RecentActivityTable = ({ activities }) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-card">
            <TableHead className="w-[20%] px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</TableHead>
            <TableHead className="w-[15%] px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</TableHead>
            <TableHead className="w-[20%] px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</TableHead>
            <TableHead className="w-[20%] px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</TableHead>
            <TableHead className="w-[15%] px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</TableHead>
            <TableHead className="w-[10%] px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities && activities.length > 0 ? (
            activities.map((activity, index) => (
              <TableRow key={index} className="bg-card hover:bg-muted/50 transition-colors duration-200">
                <TableCell className="px-6 py-4 whitespace-nowrap font-medium text-foreground">{activity.description}</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{activity.action}</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{activity.user}</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{activity.company}</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{activity.details}</TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{activity.date}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                No recent activity found. Start by adding colors or creating match requests.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default RecentActivityTable;