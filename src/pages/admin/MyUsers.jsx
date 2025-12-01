import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Search, UserPlus, Edit, Trash2, ChevronLeft, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const users = [
  {
    name: 'You',
    email: 'john.miller@company.com',
    role: 'Superadmin',
    tags: [],
    location: 'London',
  },
  {
    name: 'John Doe',
    email: 'john.doe@company.com',
    role: 'Admin',
    tags: ['Baby Care: SnugBugs', 'Brands: CleanEats'],
    location: 'Munich',
  },
];

const MyUsers = () => {
  
  const navigate = useNavigate();

  const handleActionClick = () => {
    toast({
      title: '🚧 Feature Not Implemented',
      description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  return (
    <>
      <Helmet>
        <title>My Users - Spectral</title>
        <meta name="description" content="Manage users in your organization." />
      </Helmet>
      <div className="bg-gray-50/50 min-h-screen -m-6 p-6 px-6 pt-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="w-full"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" className="mr-2 h-10 w-10" onClick={handleBackClick}>
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <h1 className="text-3xl font-bold text-gray-800">My Users</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search" className="pl-9 bg-white placeholder:text-muted-foreground/40" />
              </div>
              <Button onClick={handleActionClick} className="bg-blue-600 hover:bg-blue-700 text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <Table>
              <TableHeader>
                <TableRow className="border-b-gray-200">
                  <TableHead className="w-1/4">
                    <Button variant="ghost" size="sm" onClick={handleActionClick} className="text-gray-600 font-semibold">
                      User
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-1/6 text-gray-600 font-semibold">Roles</TableHead>
                  <TableHead className="w-1/2 text-gray-600 font-semibold">Sharing Tags</TableHead>
                  <TableHead className="w-1/6 text-gray-600 font-semibold">Location</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user, index) => (
                  <TableRow key={index} className={`border-b-0 ${user.name === 'John Doe' ? 'bg-blue-50/50' : ''}`}>
                    <TableCell>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </TableCell>
                    <TableCell className="text-gray-700">{user.role}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {user.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="bg-gray-100 text-gray-700 font-medium px-2 py-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{user.location}</TableCell>
                    <TableCell className="text-right">
                      {user.name !== 'You' && (
                        <div className="flex items-center justify-end space-x-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-800" onClick={handleActionClick}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-800" onClick={handleActionClick}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default MyUsers;