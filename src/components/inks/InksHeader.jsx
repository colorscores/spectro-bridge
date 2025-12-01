import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, BookOpen, ChevronDown, Zap, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Breadcrumb from '@/components/Breadcrumb';
import { useCanEdit } from '@/hooks/useCanEdit';
import CxfImportDialogWrapper from '@/components/cxf/CxfImportDialogWrapper';
import { cxfParser } from '@/lib/cxfParser';
import { toast } from 'react-hot-toast';
import { useInksData } from '@/context/InkContext';
import { useNavigate } from 'react-router-dom';

const InksHeader = ({ onAddNew, onAddBook, currentView }) => {
  const canEdit = useCanEdit();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [cxfDialogOpen, setCxfDialogOpen] = useState(false);
  const [cxfObjects, setCxfObjects] = useState([]);
  const { forceRefresh } = useInksData();

  const handleQuickAdd = () => {
    onAddNew();
  };

  const handleFullAdd = () => {
    // Trigger file input for CxF file selection
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log('📁 Processing CxF file:', file.name);
      const text = await file.text();
      const parsedData = cxfParser.parse(text);
      
      console.log('🎨 Parsed CxF data:', parsedData);
      
      if (parsedData && parsedData.colors && parsedData.colors.length > 0) {
        console.log('✅ Setting CxF objects and opening dialog');
        setCxfObjects(parsedData.colors);
        setCxfDialogOpen(true);
      } else {
        console.error('❌ No valid CxF data found');
        toast.error('No valid CxF data found in the file');
      }
    } catch (error) {
      console.error('❌ CxF parsing error:', error);
      toast.error('Failed to parse CxF file');
    }
    
    // Clear the input
    event.target.value = '';
  };

  const handleCxfImport = async (inkId, conditionId) => {
    try {
      setCxfDialogOpen(false);
      
      // Force refresh and wait for it to complete before navigating
      await forceRefresh();
      
      // Navigate to the inks page with the new ink at the top
      navigate('/assets/inks', {
        state: { newInkId: inkId }
      });
      
      toast.success('Ink created successfully!');
    } catch (error) {
      console.error('CxF import error:', error);
      toast.error('Failed to create ink from CxF data');
    }
  };

  return (
    <>
      {canEdit && (
        <div className="flex items-center gap-2">
          {currentView === 'book' && (
            <Button variant="outline" onClick={onAddBook}>
              <BookOpen className="mr-2 h-4 w-4" />
              Add Book
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Ink
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleQuickAdd}>
                <Zap className="mr-2 h-4 w-4" />
                <span>Quick Add</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFullAdd}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Smart Import</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Hidden file input for CxF files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".cxf,.xml"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {cxfDialogOpen && (
        <CxfImportDialogWrapper
          isOpen={true}
          onClose={() => setCxfDialogOpen(false)}
          colors={cxfObjects}
          context="ink-condition"
          onImport={handleCxfImport}
          title="Import CxF Data for Smart Import"
        />
      )}
    </>
  );
};

export default InksHeader;