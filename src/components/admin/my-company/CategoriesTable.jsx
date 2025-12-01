import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2 } from 'lucide-react';

const CategoriesTable = ({ 
  displayedCategories, 
  selectedCategory, 
  onSelectCategory, 
  onAddCategory, 
  onEditCategory, 
  onDeleteCategory,
  activeActionId,
  editing = false,
}) => {
  return (
    <Card className="border-gray-200 flex flex-col h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold text-gray-600 w-full">Category</TableHead>
            <TableHead className="text-right">
            {editing ? (
              <Button variant="link" size="sm" className="text-blue-600 font-semibold whitespace-nowrap" onClick={onAddCategory}>
                <Plus className="h-4 w-4 mr-1" />
                Add Category
              </Button>
            ) : null}
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      <div className="overflow-y-auto flex-grow">
        <Table>
          <TableBody>
            {displayedCategories.map(category => (
              <TableRow 
                key={category.id} 
                onClick={() => onSelectCategory(selectedCategory?.id === category.id ? null : category.id)} 
                className={`cursor-pointer group h-[58px] transition-colors hover:bg-muted/50 ${
                  selectedCategory?.id === category.id ? 'bg-blue-50' : ''
                }`}
              >
                <TableCell className="font-medium py-0">
                  <div className="flex items-center" style={{ paddingLeft: `${category.level * 1.5}rem` }}>
                    {category.level > 0 && <span className="w-4 mr-2 text-gray-400">└</span>}
                    <span>{category.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right py-0">
                  {editing && (
                    <div className={`flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity ${activeActionId === category.id || selectedCategory?.id === category.id ? 'opacity-100' : ''}`}>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={e => {
                          e.stopPropagation();
                          onEditCategory(category);
                        }}
                      >
                        <Edit className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={e => { e.stopPropagation(); onDeleteCategory(category.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-600" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default CategoriesTable;