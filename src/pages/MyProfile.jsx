import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Loader2, Save, X } from 'lucide-react';

const MyProfile = () => {
  const { user } = useAuth();
  const { profile: authProfile, fetchProfile: fetchAuthProfile, loading: authLoading } = useProfile();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    full_name: '',
    email: '',
    location: ''
  });
  const [organizationLocations, setOrganizationLocations] = useState([]);

  const fetchProfileData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        organization:organizations (
          id,
          name,
          type
        ),
        user_sharing_tags (
          tag:tags (
            id,
            name,
            category:categories (
              id,
              name
            )
          )
        )
      `)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      toast({ title: 'Error fetching profile', description: error.message, variant: 'destructive' });
      setProfile(null);
    } else if (data) {
      const formattedData = {
        ...data,
        email: user.email,
        tags: data.user_sharing_tags.map(ust => ({
          id: ust.tag.id,
          name: ust.tag.name,
          categoryName: ust.tag.category.name,
        })).filter(Boolean),
      };
      setProfile(formattedData);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if (authProfile) {
      setProfile({
        ...authProfile,
        email: user.email,
      });
      fetchProfileData();
    } else if (user && !authLoading) {
      fetchProfileData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authProfile, authLoading, fetchProfileData]);

  const fetchOrganizationLocations = useCallback(async () => {
    if (!profile?.organization?.id) return;
    
    const { data, error } = await supabase
      .from('organization_locations')
      .select('id, name')
      .eq('organization_id', profile.organization.id)
      .order('name');
    
    if (error) {
      console.error('Error fetching organization locations:', error);
    } else {
      setOrganizationLocations(data || []);
    }
  }, [profile?.organization?.id]);

  useEffect(() => {
    if (profile?.organization?.id) {
      fetchOrganizationLocations();
    }
  }, [profile?.organization?.id, fetchOrganizationLocations]);

  const getInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names.map((n) => n[0]).join('').toUpperCase();
  };
  
  const handleEditClick = () => {
    setEditedProfile({
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      location: profile?.location || ''
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedProfile({
      full_name: '',
      email: '',
      location: ''
    });
  };

  const handleInputChange = (field, value) => {
    setEditedProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    // Basic validation
    if (!editedProfile.full_name.trim()) {
      toast({ title: 'Validation Error', description: 'Full name is required.', variant: 'destructive' });
      return;
    }
    
    if (!editedProfile.email.trim()) {
      toast({ title: 'Validation Error', description: 'Email address is required.', variant: 'destructive' });
      return;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editedProfile.email)) {
      toast({ title: 'Validation Error', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    
    try {
      const response = await supabase.functions.invoke('update-user-details', {
        body: {
          userId: user.id,
          fullName: editedProfile.full_name,
          email: editedProfile.email,
          location: editedProfile.location || null
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update profile');
      }

      toast({ 
        title: 'Success!', 
        description: 'Your profile has been updated successfully.' 
      });
      
      setIsEditing(false);
      await fetchProfileData();
      await fetchAuthProfile();
      
    } catch (error) {
      console.error('Error updating profile:', error);
      
      if (error.message === 'EMAIL_EXISTS') {
        toast({ 
          title: 'Email Error', 
          description: 'This email address is already registered to another account.', 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Update Error', 
          description: error.message || 'Failed to update profile. Please try again.', 
          variant: 'destructive' 
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-4 text-lg">Loading profile...</span>
      </div>
    );
  }

  if (!profile) {
    return <div className="flex justify-center items-center h-screen">Could not load profile. It might not have been created yet.</div>;
  }

  return (
    <>
      <Helmet>
        <title>My Profile - Spectral</title>
        <meta name="description" content="View and manage your profile details." />
      </Helmet>
      <div className="bg-gray-50/50 min-h-screen -m-6 p-6 flex justify-center items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="w-full max-w-3xl"
        >
          <Card className="overflow-hidden shadow-lg border-gray-200">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
              <div className="flex items-center space-x-6">
                <Avatar className="h-24 w-24 border-4 border-white shadow-md">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}`} alt={profile.full_name} />
                  <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">{profile.full_name}</h1>
                  <p className="text-lg text-gray-600">{profile.role}</p>
                </div>
              </div>
            </div>
            <CardContent className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold text-gray-700">Personal Information</h2>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={handleEditClick}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <Label className="text-gray-500">Full Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      placeholder="Enter your full name"
                      className="mt-1"
                      disabled={isSaving}
                    />
                  ) : (
                    <p className="text-gray-800 font-medium text-lg">{profile.full_name}</p>
                  )}
                </div>
                <div>
                  <Label className="text-gray-500">Email Address</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedProfile.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter your email address"
                      className="mt-1"
                      disabled={isSaving}
                    />
                  ) : (
                    <p className="text-gray-800 font-medium text-lg">{profile.email}</p>
                  )}
                </div>
                <div>
                  <Label className="text-gray-500">Role</Label>
                  <p className="text-gray-800 font-medium text-lg">{profile.role}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Location</Label>
                  {isEditing ? (
                    <Select
                      value={editedProfile.location || "not-specified"}
                      onValueChange={(value) => handleInputChange('location', value === "not-specified" ? "" : value)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-specified">Not specified</SelectItem>
                        {organizationLocations.map(location => (
                          <SelectItem key={location.id} value={location.name}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-gray-800 font-medium text-lg">{profile.location || 'Not specified'}</p>
                  )}
                </div>
                <div>
                  <Label className="text-gray-500">Organization</Label>
                  <p className="text-gray-800 font-medium text-lg">{profile.organization?.name || 'Not assigned'}</p>
                </div>
                {profile.organization?.type && (
                  <div>
                    <Label className="text-gray-500">Organization Type</Label>
                    <p className="text-gray-800 font-medium text-lg capitalize">{profile.organization.type}</p>
                  </div>
                )}
              </div>

              <div className="mt-10">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Permissions & Access</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                        <Label>Access to other locations</Label>
                        <Badge variant={profile.allow_other_locations ? 'default' : 'secondary'} className={profile.allow_other_locations ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>
                            {profile.allow_other_locations ? 'Allowed' : 'Not Allowed'}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                        <Label>Content visibility limited by tags</Label>
                        <Badge variant={profile.limit_by_tags ? 'default' : 'secondary'} className={profile.limit_by_tags ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}>
                            {profile.limit_by_tags ? 'Yes' : 'No'}
                        </Badge>
                    </div>
                    {profile.limit_by_tags && (
                        <div className="p-4 border rounded-lg">
                            <Label className="mb-3 block">Sharing Tags</Label>
                            <div className="flex flex-wrap gap-2">
                                {profile.tags.length > 0 ? profile.tags.map(tag => (
                                    <Badge key={tag.id} variant="secondary" className="bg-gray-100 text-gray-700 font-medium px-2 py-1">
                                        {tag.categoryName}: {tag.name}
                                    </Badge>
                                )) : <p className="text-gray-500 text-sm">No sharing tags assigned.</p>}
                            </div>
                        </div>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default MyProfile;