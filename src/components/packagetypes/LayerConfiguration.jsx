import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LayerItem = ({ label, color, hasSerration = false }) => (
  <div className={`relative border-x border-b border-gray-400 bg-white px-4 py-2 text-center text-sm font-medium text-gray-600 ${color}`}>
    {hasSerration && (
      <div 
        className="absolute -top-px left-0 right-0 h-2 bg-repeat-x"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg width='10' height='4' viewBox='0 0 10 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M0 4L5 0L10 4' stroke='%239CA3AF' stroke-width='0.5'/%3e%3c/svg%3e")`,
        }}
      />
    )}
    {label}
  </div>
);

const LayerConfiguration = ({ packageType }) => {
  const { toast } = useToast();
  const [useFinishCoat, setUseFinishCoat] = useState(false);
  const [useLaminate, setUseLaminate] = useState(false);
  const [useBasecoat, setUseBasecoat] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(packageType.name);

  useEffect(() => {
    setName(packageType.name);
  }, [packageType.name]);

  const handleSave = () => {
    setIsEditing(false);
    toast({
      title: "Name Updated!",
      description: `Package type name changed to "${name}".`,
    });
  };

  const handleCancel = () => {
    setName(packageType.name);
    setIsEditing(false);
  };

  const CheckboxOption = ({ id, label, checked, onCheckedChange, children }) => (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
          <Label htmlFor={id} className="font-normal text-gray-700">{label}</Label>
        </div>
        <AnimatePresence>
          {checked && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '150px' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-grow">
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="text-2xl font-bold h-10"
              />
            </div>
          ) : (
            <CardTitle className="text-2xl font-bold">{name}</CardTitle>
          )}
          <div className="flex items-center gap-2 ml-4">
            {isEditing ? (
              <>
                <Button onClick={handleSave} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <Label htmlFor="print-process" className="text-base font-semibold">Print Process</Label>
              <Select>
                <SelectTrigger id="print-process" className="w-[200px]">
                  <SelectValue placeholder="Select Process" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flexo">Flexo</SelectItem>
                  <SelectItem value="gravure">Gravure</SelectItem>
                  <SelectItem value="offset">Offset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg p-6 space-y-4 bg-gray-50/50">
              <div className="flex items-center space-x-3">
                <Checkbox id="reverse-print" />
                <Label htmlFor="reverse-print" className="font-normal text-gray-700">Reverse print</Label>
              </div>
              <CheckboxOption id="use-finish-coat" label="Use finish coat" checked={useFinishCoat} onCheckedChange={setUseFinishCoat}>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Coat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gloss">Gloss Varnish</SelectItem>
                    <SelectItem value="matte">Matte Varnish</SelectItem>
                  </SelectContent>
                </Select>
              </CheckboxOption>
              <CheckboxOption id="use-laminate" label="Use laminate" checked={useLaminate} onCheckedChange={setUseLaminate}>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Laminate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pe">PE</SelectItem>
                    <SelectItem value="pet">PET</SelectItem>
                  </SelectContent>
                </Select>
              </CheckboxOption>
              <CheckboxOption id="use-basecoat" label="Use basecoat" checked={useBasecoat} onCheckedChange={setUseBasecoat}>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Basecoat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="primer">Primer</SelectItem>
                  </SelectContent>
                </Select>
              </CheckboxOption>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-4 mb-4">
              <Label htmlFor="structure" className="text-base font-semibold">Structure</Label>
              <Select>
                <SelectTrigger id="structure" className="w-[200px]">
                  <SelectValue placeholder="Select Structure" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pouch">Pouch</SelectItem>
                  <SelectItem value="sleeve">Sleeve</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg p-6 bg-gray-200 h-full flex items-center justify-center">
              <div className="w-4/5">
                <AnimatePresence>
                  {useFinishCoat && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                      <LayerItem label="Finish Coat" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <LayerItem label="Ink" hasSerration={!useFinishCoat} />
                <AnimatePresence>
                  {useLaminate && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                      <LayerItem label="Laminate" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <LayerItem label="Substrate" />
                <AnimatePresence>
                  {useBasecoat && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                      <LayerItem label="Basecoat" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LayerConfiguration;