import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useInksData } from '@/context/InkContext';
import { labToHex } from '@/lib/substrateColors';
import { MultiSelect } from '@/components/ui/multi-select';

const PrinterConditionInfoTab = ({ 
  condition, 
  onConditionChange, 
  canEdit, 
  isNew,
  selectedInkBooks,
  onSelectedInkBooksChange
}) => {
  const [substrateConditions, setSubstrateConditions] = useState([]);
  const [isLocked, setIsLocked] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isSettling, setIsSettling] = useState(false);
  const [characterizationData, setCharacterizationData] = useState({
    fileName: '',
    inkSetup: []
  });
  const [adaptToSubstrate, setAdaptToSubstrate] = useState(false);
  
  const { inkBooks } = useInksData();

  useEffect(() => {
    fetchSubstrateConditions();
    // For new conditions, start with empty data
    if (isNew) {
      setCharacterizationData({
        fileName: '',
        inkSetup: []
      });
    } else {
      // Fetch characterization data from database for existing conditions
      fetchCharacterizationData();
    }
  }, [isNew, condition?.id]);

  const fetchSubstrateConditions = async () => {
    try {
      const { data, error } = await supabase
        .from('substrates')
        .select(`
          id,
          name,
          substrate_conditions (
            id,
            name
          )
        `);

      if (error) {
        console.error('Error fetching substrate conditions:', error);
        return;
      }

      // Flatten the data to create substrate-condition combinations
      const combinations = [];
      data?.forEach(substrate => {
        if (substrate.substrate_conditions && substrate.substrate_conditions.length > 0) {
          substrate.substrate_conditions.forEach(condition => {
            combinations.push({
              value: `${substrate.id}_${condition.id}`,
              label: `${substrate.name} - ${condition.name}`,
              substrateId: substrate.id,
              conditionId: condition.id
            });
          });
        } else {
          // Substrate without conditions
          combinations.push({
            value: substrate.id,
            label: substrate.name,
            substrateId: substrate.id,
            conditionId: null
          });
        }
      });

      setSubstrateConditions(combinations);
    } catch (error) {
      console.error('Error fetching substrate conditions:', error);
    }
  };

  const fetchCharacterizationData = async () => {
    if (!condition?.id) return;
    
    try {
      const { data: characterization, error: charError } = await supabase
        .from('printer_condition_characterizations')
        .select('*')
        .eq('printer_condition_id', condition.id)
        .maybeSingle();

      if (charError) {
        console.error('Error fetching characterization data:', charError);
        return;
      }

      if (characterization) {
        const { data: inkSetups, error: inkError } = await supabase
          .from('printer_condition_ink_setups')
          .select('*')
          .eq('characterization_id', characterization.id)
          .order('sort_order');

        if (inkError) {
          console.error('Error fetching ink setups:', inkError);
          return;
        }

        setCharacterizationData({
          fileName: characterization.file_name || '',
          inkSetup: inkSetups?.map(ink => ({
            name: ink.name,
            usage: ink.usage,
            curve: ink.curve,
            screeningType: ink.screening_type,
            screenRuling: ink.screen_ruling,
            screenAngle: ink.screen_angle
          })) || []
        });

        setAdaptToSubstrate(characterization.adapt_to_substrate || false);
      }
    } catch (error) {
      console.error('Error fetching characterization data:', error);
    }
  };

  const handleConditionNameChange = (value) => {
    onConditionChange({ ...condition, name: value });
  };

  const handleSubstrateConditionChange = (value) => {
    const selected = substrateConditions.find(sc => sc.value === value);
    onConditionChange({ 
      ...condition, 
      substrate_id: selected?.substrateId,
      substrate_condition_id: selected?.conditionId
    });
  };

  const getColorForInk = (inkName) => {
    const colors = {
      'Yellow': 'bg-yellow-400',
      'Magenta': 'bg-pink-500',
      'Cyan': 'bg-cyan-500',
      'Black': 'bg-gray-800',
      'Orange': 'bg-orange-500',
      'Green': 'bg-green-500',
      'Violet': 'bg-purple-500'
    };
    return colors[inkName] || 'bg-gray-400';
  };


  // Mock substrate Lab values - in production, these would come from the selected substrate condition
  const substrateLabValues = { l: 95.2, a: -0.8, b: 2.1 };
  const substrateColor = labToHex(substrateLabValues.l, substrateLabValues.a, substrateLabValues.b);

  const handleDragStart = (e, index) => {
    if (isLocked) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a custom drag image to constrain movement
    const dragImage = e.currentTarget.cloneNode(true);
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(2deg)';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Remove the drag image after drag starts
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
  };

  const handleDragOver = (e) => {
    if (isLocked || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = e.currentTarget.getBoundingClientRect();
    const rowMiddle = rect.top + rect.height / 2;
    const index = parseInt(e.currentTarget.dataset.index);
    
    // Determine if we should place before or after this row
    if (e.clientY < rowMiddle) {
      setDragOverIndex(index);
    } else {
      setDragOverIndex(index + 1);
    }
  };

  const handleDrop = (e) => {
    if (isLocked || draggedIndex === null || dragOverIndex === null) return;
    e.preventDefault();
    
    const newInkSetup = [...characterizationData.inkSetup];
    const draggedItem = newInkSetup[draggedIndex];
    
    // Remove the dragged item
    newInkSetup.splice(draggedIndex, 1);
    
    // Adjust drop index if we removed an item before it
    const adjustedDropIndex = dragOverIndex > draggedIndex ? dragOverIndex - 1 : dragOverIndex;
    
    // Insert at the new position
    newInkSetup.splice(adjustedDropIndex, 0, draggedItem);
    
    setCharacterizationData({
      ...characterizationData,
      inkSetup: newInkSetup
    });
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    
    // Trigger settling animation
    setIsSettling(true);
    setTimeout(() => {
      setIsSettling(false);
    }, 400);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const usageOptions = [
    'Separation Cyan',
    'Separation Magenta', 
    'Separation Yellow',
    'Contrast Black',
    'Separation (other)',
    'Contrast (other)'
  ];

  const screeningTypeOptions = [
    'AM Screen',
    'FM Screen',
    'Flexo AM Screen', 
    'Gravure Screen'
  ];

  const updateInkSetup = (index, field, value) => {
    const newInkSetup = [...characterizationData.inkSetup];
    newInkSetup[index] = { ...newInkSetup[index], [field]: value };
    setCharacterizationData({
      ...characterizationData,
      inkSetup: newInkSetup
    });
  };

  return (
    <div className="space-y-6">
      {/* Top section with condition info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="condition-name">Condition Name</Label>
              <Input
                id="condition-name"
                value={condition?.name || ''}
                onChange={(e) => handleConditionNameChange(e.target.value)}
                disabled={!canEdit}
                placeholder="Enter condition name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="substrate-condition">Substrate & Substrate Condition</Label>
              <Select
                value={condition?.substrate_condition_combo || ''}
                onValueChange={handleSubstrateConditionChange}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select substrate & condition" />
                </SelectTrigger>
                <SelectContent>
                  {substrateConditions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="characterization-data">Characterization Data</Label>
              <Input
                id="characterization-data"
                value={characterizationData.fileName}
                disabled
                placeholder="No file selected"
                className="bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Characterization Substrate section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Characterization Substrate</CardTitle>
        </CardHeader>
        <CardContent>
          {characterizationData.fileName ? (
            <div className="flex items-center">
              {/* Match table spacing: CardContent p-6 (24px) + TableCell p-4 left (16px) = 40px, but visually appears less */}
              <div className="w-6"></div> {/* 24px spacing to visually align with table */}
              <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: substrateColor }}></div>
              <div className="ml-8 space-y-1"> {/* 32px to match TableCell spacing */}
                <div className="text-sm text-muted-foreground">Lab Values</div>
                <div className="flex gap-4 text-sm">
                  <span>L*: 95.2</span>
                  <span>a*: -0.8</span>
                  <span>b*: 2.1</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No characterization data imported.</p>
              <p className="text-sm">Use "Import Measurement" to add characterization data from a file.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Characterization Ink Setup section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Characterization Ink Setup</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLocked(!isLocked)}
              className="flex items-center gap-2"
            >
              {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              {isLocked ? 'Locked' : 'Unlocked'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {characterizationData.inkSetup.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isLocked && <TableHead className="w-8"></TableHead>}
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Curve</TableHead>
                    <TableHead>Screening Type</TableHead>
                    <TableHead>Screen Ruling</TableHead>
                    <TableHead>Screen Angle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  {characterizationData.inkSetup.map((ink, index) => {
                    const isDragging = draggedIndex === index;
                    
                    // When a row is picked up, rows below it slide up to close the gap
                    const shouldSlideUpToCloseGap = draggedIndex !== null && 
                                                   index > draggedIndex && 
                                                   dragOverIndex === null;
                    
                    // When dragging over rows, they slide down to make space
                    const shouldSlideDownToMakeSpace = dragOverIndex !== null && 
                                                       draggedIndex !== null && 
                                                       draggedIndex !== index &&
                                                       ((dragOverIndex <= index && draggedIndex > index) ||
                                                        (dragOverIndex > draggedIndex && index >= dragOverIndex));
                    
                    return (
                      <TableRow 
                        key={`${ink.name}-${index}`}
                        data-index={index}
                        draggable={!isLocked}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                         className={`
                           ${!isLocked ? 'cursor-move' : ''} 
                           ${isDragging ? 'opacity-30 scale-95 z-10' : ''} 
                           ${shouldSlideUpToCloseGap ? '-translate-y-12' : ''} 
                           ${shouldSlideDownToMakeSpace ? 'translate-y-12' : ''} 
                           ${isSettling ? 'transition-all duration-500 ease-out' : 'transition-all duration-300 ease-out'}
                         `}
                      >
                        {!isLocked && (
                          <TableCell className="text-center">
                            <GripVertical className="h-4 w-4 text-muted-foreground mx-auto" />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className={`w-6 h-6 rounded ${getColorForInk(ink.name)}`}></div>
                        </TableCell>
                         <TableCell className="font-medium">{ink.name}</TableCell>
                         <TableCell>
                           <Select
                             value={ink.usage}
                             onValueChange={(value) => updateInkSetup(index, 'usage', value)}
                             disabled={isLocked}
                           >
                             <SelectTrigger className="w-full">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               {usageOptions.map((option) => (
                                 <SelectItem key={option} value={option}>
                                   {option}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </TableCell>
                         <TableCell>{ink.curve}</TableCell>
                         <TableCell>
                           <Select
                             value={ink.screeningType}
                             onValueChange={(value) => updateInkSetup(index, 'screeningType', value)}
                             disabled={isLocked}
                           >
                             <SelectTrigger className="w-full">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               {screeningTypeOptions.map((option) => (
                                 <SelectItem key={option} value={option}>
                                   {option}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-1">
                             <Input
                               type="number"
                               value={ink.screenRuling}
                               onChange={(e) => updateInkSetup(index, 'screenRuling', parseInt(e.target.value) || 0)}
                               disabled={isLocked}
                               className="w-20"
                             />
                             <span className="text-sm text-muted-foreground">lpi</span>
                           </div>
                         </TableCell>
                         <TableCell>
                           <Input
                             type="number"
                             value={ink.screenAngle}
                             onChange={(e) => updateInkSetup(index, 'screenAngle', parseInt(e.target.value) || 0)}
                             disabled={isLocked}
                             className="w-16"
                           />
                         </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No ink setup data available.</p>
              <p className="text-sm">Import a characterization file to see ink setup details.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Inks section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Additional Inks</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="ink-books">Ink Books</Label>
               <MultiSelect
                 options={inkBooks?.map(book => ({ value: book.id, label: book.name })) || []}
                 selected={selectedInkBooks}
                 onChange={onSelectedInkBooksChange}
                 placeholder="Select ink books"
                 className="w-full"
               />
             </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="adapt-inks"
                checked={adaptToSubstrate}
                onCheckedChange={setAdaptToSubstrate}
              />
              <Label htmlFor="adapt-inks" className="text-sm">
                Adapt inks to this substrate and substrate condition
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrinterConditionInfoTab;