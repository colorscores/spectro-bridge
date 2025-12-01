import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PlusCircle, ListFilter } from 'lucide-react';
import AddPartnerWizard from '@/components/partners/AddPartnerWizard';
import PartnerCard from '@/components/partners/PartnerCard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { usePartners } from '@/hooks/usePartners';


const Partners = () => {
    const { profile } = useProfile();
    const { partners, partnersLoading, partnersError, refetchPartners } = usePartners();

    console.log('👥 Partners page - Render state:', {
        profile_exists: !!profile,
        organization_id: profile?.organization_id,
        partners_count: partners?.length || 0,
        partners_loading: partnersLoading,
        partners_error: partnersError,
        partners_data: partners
    });
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isDeleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [isEditWizardOpen, setIsEditWizardOpen] = useState(false);
    const [partnerToDelete, setPartnerToDelete] = useState(null);
    const [partnerToEdit, setPartnerToEdit] = useState(null);

    const handleUpdate = () => {
        refetchPartners();
    };

    const openWizardEdit = (partner) => {
        setPartnerToEdit(partner);
        setIsEditWizardOpen(true);
    };

    const handleOpenDeleteConfirmation = (partnerOrgId, partnerName) => {
        setPartnerToDelete({ id: partnerOrgId, name: partnerName });
        setDeleteConfirmationOpen(true);
    };

    const handleDeletePartner = async () => {
        if (!partnerToDelete || !profile?.organization_id) {
            toast({ variant: "destructive", title: "Error", description: "Partner information is missing." });
            return;
        }
        
        try {
            const { error } = await supabase.rpc('delete_partner_connection', {
                p_org_id_1: profile.organization_id,
                p_org_id_2: partnerToDelete.id,
            });

            if (error) throw error;

            toast({ title: "Success", description: `Connection with ${partnerToDelete.name} has been removed.` });
            handleUpdate();
        } catch (error) {
            toast({ variant: "destructive", title: "Failed to delete partner", description: error.message });
        } finally {
            setDeleteConfirmationOpen(false);
            setPartnerToDelete(null);
        }
    };

    const renderSkeletons = () => (
        Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-40" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                </div>
                <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <div className="pt-4 border-t">
                    <Skeleton className="h-4 w-28" />
                </div>
            </div>
        ))
    );

    return (
        <>
            <Helmet>
                <title>Partners - Spectral</title>
                <meta name="description" content="Manage your partner connections" />
            </Helmet>
            
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="px-6 pt-6 space-y-6"
                >
                    <div className="flex justify-between items-center">
                        
                            <h1 className="text-3xl font-bold text-gray-800">Partners</h1>
                            
                        <div className="flex gap-2">
                            <Button variant="outline">
                                <ListFilter className="mr-2 h-4 w-4" />
                                Filter
                            </Button>
                            <AddPartnerWizard open={isWizardOpen} onOpenChange={setIsWizardOpen} onInvite={handleUpdate}>
                                <Button onClick={() => setIsWizardOpen(true)}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Partner
                                </Button>
                            </AddPartnerWizard>
                        </div>
                    </div>

                {partnersError && <div className="text-red-500">Error: {partnersError}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {partnersLoading ? renderSkeletons() :
                        partners && partners.map((partner) => (
                            <PartnerCard 
                                key={partner.id} 
                                partner={partner} 
                                onEdit={openWizardEdit}
                                onDelete={handleOpenDeleteConfirmation}
                            />
                        ))
                    }
                </div>

                {!partnersLoading && partners && partners.length === 0 && (
                    <div className="text-center py-16 border-2 border-dashed rounded-lg col-span-full">
                        <h3 className="text-xl font-semibold">No partners found</h3>
                        <p className="text-muted-foreground mt-2">Get started by adding a new partner.</p>
                        <AddPartnerWizard open={isWizardOpen} onOpenChange={setIsWizardOpen} onInvite={handleUpdate}>
                            <Button className="mt-4" onClick={() => setIsWizardOpen(true)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Partner
                            </Button>
                        </AddPartnerWizard>
                    </div>
                )}
                </motion.div>

            <AlertDialog open={isDeleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove your connection with {partnerToDelete?.name}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePartner}>
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AddPartnerWizard 
                open={isEditWizardOpen}
                onOpenChange={setIsEditWizardOpen}
                onInvite={handleUpdate}
                mode="edit"
                editPartner={partnerToEdit}
            />
        </>
    );
};

export default Partners;