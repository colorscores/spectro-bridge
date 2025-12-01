import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const orgTypeOptions = [
  { value: "Brand Owner", label: "Brand Owner" },
  { value: "Print Supplier", label: "Print Supplier" },
  { value: "Premedia Agency", label: "Premedia Agency" },
  { value: "Design Agency", label: "Design Agency" },
  { value: "Vendor", label: "Vendor" },
  { value: "Ink Supplier", label: "Ink Supplier" },
];

const AddOrganizationDialog = ({ isOpen, setIsOpen, onOrganizationAdded }) => {
  
  const [isLoading, setIsLoading] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [organizationTypes, setOrganizationTypes] = useState([]);
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Step 1: Create the organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, type: organizationTypes })
      .select()
      .single();

    if (orgError) {
      toast({
        variant: 'destructive',
        title: 'Failed to create organization',
        description: orgError.message,
      });
      setIsLoading(false);
      return;
    }

    // Step 2: Create the admin user for the organization
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: adminEmail,
          password: adminPassword,
          fullName: adminFullName,
          role: 'Admin',
          organizationId: orgData.id,
        },
      });

      if (error) throw error;

      if (data.error) {
         throw new Error(data.error);
      }

      const actionMessage = data?.action === 'linked' 
        ? `Organization "${orgName}" created and existing user ${adminFullName} linked as admin.`
        : `Organization "${orgName}" and admin user ${adminFullName} have been created.`;
        
      toast({
        title: 'Organization created successfully!',
        description: actionMessage,
      });
      onOrganizationAdded();
      setIsOpen(false);
      // Reset form
      setOrgName('');
      setOrganizationTypes([]);
      setAdminFullName('');
      setAdminEmail('');
      setAdminPassword('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create admin user',
        description: error.message,
      });
      // Rollback organization creation
      await supabase.from('organizations').delete().eq('id', orgData.id);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleCreateOrganization}>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Create a new organization and its initial administrator account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Organization Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-type">Organization Types</Label>
                  <MultiSelect
                    options={orgTypeOptions}
                    selected={organizationTypes}
                    onChange={setOrganizationTypes}
                    placeholder="Select organization types..."
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Initial Administrator</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Full Name</Label>
                  <Input
                    id="admin-name"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email Address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="e.g. jane.doe@acme.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Temporary Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Must be at least 6 characters"
                  required
                  minLength={6}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddOrganizationDialog;