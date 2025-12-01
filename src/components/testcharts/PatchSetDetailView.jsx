import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import Breadcrumb from '@/components/Breadcrumb';
import { formatPatchCount, getChannelName } from '@/utils/colorUtils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PatchSetDetailView = ({ patchSet, onBack, testCharts = [] }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: patchSet?.name || '',
    colorspace: patchSet?.colorspace || '',
    number_of_patches: patchSet?.number_of_patches || '',
    creation_method: patchSet?.creation_method || 'import'
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setFormData({
      name: patchSet?.name || '',
      colorspace: patchSet?.colorspace || '',
      number_of_patches: patchSet?.number_of_patches || '',
      creation_method: patchSet?.creation_method || 'import'
    });
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    setIsEditMode(false);
  };

  const breadcrumbItems = [
    { label: 'Test Charts', href: '/assets/testcharts' },
    { label: patchSet?.name || 'Patch Set Details' }
  ];

  const pageTitle = patchSet?.name || 'Patch Set Details';

  return (
    <>
      <Helmet>
        <title>{pageTitle} - Color KONTROL</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col h-full p-4 sm:p-6 lg:p-8"
      >
        {/* Breadcrumb */}
        <div className="mb-2">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md border border-gray-200 flex items-center justify-center bg-blue-50">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
          </div>
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="flex-grow flex flex-col">
          <TabsList className="mb-4 self-start">
            <TabsTrigger value="info">Patchset Info</TabsTrigger>
            <TabsTrigger value="testcharts">Testcharts</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Tab Content in Card */}
          <Card className="flex-grow bg-white shadow-sm">
            <CardContent className="p-6">
              <TabsContent value="info" className="mt-0">
                <div className="max-w-2xl space-y-6">
                  <div>
                    <Label htmlFor="patch-set-name">Patch Set Name</Label>
                    <Input
                      id="patch-set-name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={!isEditMode}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-base font-medium">Import/Create New</Label>
                    <RadioGroup
                      value={formData.creation_method}
                      onValueChange={(value) => handleInputChange('creation_method', value)}
                      disabled={!isEditMode}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="import" id="import" />
                        <Label htmlFor="import" className="font-normal">Import</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="create" id="create" />
                        <Label htmlFor="create" className="font-normal">Create New</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="colorspace">Colorspace</Label>
                    <Select
                      value={formData.colorspace}
                      onValueChange={(value) => handleInputChange('colorspace', value)}
                      disabled={!isEditMode}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select colorspace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CMYK">CMYK</SelectItem>
                        <SelectItem value="RGB">RGB</SelectItem>
                        <SelectItem value="LAB">LAB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="patches"># of patches</Label>
                    <Input
                      id="patches"
                      type="number"
                      value={formData.number_of_patches}
                      onChange={(e) => handleInputChange('number_of_patches', e.target.value)}
                      disabled={!isEditMode}
                      className="mt-1"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="testcharts" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Associated Test Charts ({testCharts.length})</h3>
                    <Button size="sm">Add Test Chart</Button>
                  </div>
                  
                  {testCharts.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Instrument</TableHead>
                          <TableHead>Pages</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testCharts.map((chart) => (
                          <TableRow key={chart.id}>
                            <TableCell className="font-medium">{chart.name}</TableCell>
                            <TableCell>{chart.instrument || '-'}</TableCell>
                            <TableCell>{chart.number_of_pages || '-'}</TableCell>
                            <TableCell>{chart.patch_size || '-'}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">View</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No test charts associated with this patch set
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <div className="text-center py-12 text-muted-foreground">
                  History will be displayed here
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </motion.div>
    </>
  );
};

export default PatchSetDetailView;