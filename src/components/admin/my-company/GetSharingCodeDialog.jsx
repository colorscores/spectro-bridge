import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

const GetSharingCodeDialog = ({ isOpen, setIsOpen, organization, locations }) => {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();
  

  useEffect(() => {
    if (!isOpen) {
      setSelectedLocation('');
      setGeneratedCode('');
    }
  }, [isOpen]);

  const generateCode = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerateCode = async () => {
    if (!selectedLocation) {
      toast({ title: 'Please select a location.', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);

    const code = generateCode();
    
    const { error } = await supabase.from('sharing_codes').insert({
      code,
      organization_id: organization.id,
      location_id: selectedLocation,
      created_by: user.id
    });

    if (error) {
      toast({ title: 'Error generating code', description: error.message, variant: 'destructive' });
      setIsGenerating(false);
    } else {
      setGeneratedCode(code);
      toast({ title: 'Sharing code generated!', description: 'The code will expire in 7 days.' });
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    toast({ title: 'Copied to clipboard!' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sharing Code</DialogTitle>
          <DialogDescription>
            Generate a unique code for a specific location to share with partners.
          </DialogDescription>
        </DialogHeader>
        
        {!generatedCode ? (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleGenerateCode} disabled={isGenerating || !selectedLocation}>
                {isGenerating ? 'Generating...' : 'Generate Code'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground">Share this code with your partner. It will expire in 7 days.</p>
              <div className="flex items-center space-x-2">
                <div className="text-2xl font-mono bg-muted rounded-md px-4 py-2 w-full text-center tracking-widest">
                  {generatedCode}
                </div>
                <Button variant="outline" size="icon" onClick={handleCopyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
               <Button onClick={() => setIsOpen(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GetSharingCodeDialog;