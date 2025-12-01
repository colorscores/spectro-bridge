import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProfile } from '@/context/ProfileContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { supabase } from '@/lib/customSupabaseClient';
import AddUserDialog from '@/components/admin/users/AddUserDialog';
import AddLocationDialog from '@/components/admin/my-company/AddLocationDialog';
import AddPartnerWizard from '@/components/partners/AddPartnerWizard';
import GetSharingCodeDialog from '@/components/admin/my-company/GetSharingCodeDialog';
import SharingCodeRequirementsDialog from '@/components/admin/my-company/SharingCodeRequirementsDialog';
import Notifications from '@/components/dashboard/Notifications';
import RecentActivityTable from '@/components/dashboard/RecentActivityTable';

import { Users, UserPlus, MapPin, HeartHandshake as Handshake, Share2, Award, Bell, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MatrixExporter from '@/components/admin/MatrixExporter';
import { formatDistanceToNow } from 'date-fns';

const StatCard = ({ icon: Icon, title, value, loading }) => (
  <Card className="w-full">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-full bg-blue-100">
          <Icon className="h-6 w-6 text-blue-500" />
        </div>
        {loading ? (
          <Skeleton className="h-10 w-16" />
        ) : (
          <div className="text-4xl font-bold">{value}</div>
        )}
      </div>
    </CardContent>
  </Card>
);

const AdminDashboard = () => {
  const { profile } = useProfile();
  const { isSuperadmin } = useRoleAccess();
  const orgId = profile?.organization_id;
  const navigate = useNavigate();
  // Temporarily disable activity hook to stabilize admin dashboard
  const activities = [];
  const activitiesLoading = false;

  const [counts, setCounts] = React.useState({
    users: 0,
    admins: 0,
    locations: 0,
    partners: 0,
  });
  const [loadingCounts, setLoadingCounts] = React.useState(true);

  const [notifications, setNotifications] = React.useState([]);
  const [loadingNotifications, setLoadingNotifications] = React.useState(true);

  const [isAddUserOpen, setIsAddUserOpen] = React.useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = React.useState(false);
  const [isAddPartnerOpen, setIsAddPartnerOpen] = React.useState(false);
  const [isGetCodeOpen, setIsGetCodeOpen] = React.useState(false);
  const [isRequirementsOpen, setIsRequirementsOpen] = React.useState(false);
  const [isMatrixExporterOpen, setIsMatrixExporterOpen] = React.useState(false);

  const [organization, setOrganization] = React.useState(null);
  const [locations, setLocations] = React.useState([]);

  // Get the last 4 activities for the dashboard
  const recentActivities = activities.slice(0, 4).map(activity => ({
    description: activity.activity,
    action: activity.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Activity',
    user: activity.user,
    company: activity.company,
    details: activity.details || (activity.receiver !== '-' ? `To: ${activity.receiver}` : ''),
    date: activity.date,
  }));

  const refetchAll = React.useCallback(() => {
    fetchCounts();
    fetchNotifications();
    fetchOrgAndLocations();
  }, []);

  const fetchCounts = React.useCallback(async () => {
    if (!orgId) return;
    setLoadingCounts(true);
    try {
      const [usersRes, adminsRes, locationsRes, partnersRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).in('role', ['Admin', 'Superadmin']),
        supabase.from('organization_locations').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('partners').select('id', { count: 'exact', head: true }).or(`organization_id.eq.${orgId},partner_organization_id.eq.${orgId}`),
      ]);
      setCounts({
        users: usersRes.count || 0,
        admins: adminsRes.count || 0,
        locations: locationsRes.count || 0,
        partners: partnersRes.count || 0,
      });
    } finally {
      setLoadingCounts(false);
    }
  }, [orgId]);

  const fetchNotifications = React.useCallback(async () => {
    if (!orgId) return;
    setLoadingNotifications(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, message, metadata, created_at')
        .eq('organization_id', orgId)
        .in('type', ['partner_invite', 'partner_status', 'partner_share_update'])
        .order('created_at', { ascending: false })
        .limit(5);
      setNotifications(data || []);
    } finally {
      setLoadingNotifications(false);
    }
  }, [orgId]);

  const fetchOrgAndLocations = React.useCallback(async () => {
    if (!orgId) return;
    const [{ data: org }, { data: locs }] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', orgId).single(),
      supabase.from('organization_locations').select('*').eq('organization_id', orgId).order('name'),
    ]);
    setOrganization(org || null);
    setLocations(locs || []);
  }, [orgId]);

  React.useEffect(() => {
    fetchCounts();
    fetchNotifications();
    fetchOrgAndLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Spectral</title>
        <meta name="description" content="Admin controls, metrics, notifications, and recent activity." />
        <link rel="canonical" href="/admin/dashboard" />
      </Helmet>
      <div className="space-y-8 p-4 md:p-8 pt-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage users, locations, partners and sharing.</p>
          {!orgId && (
            <p className="text-sm text-muted-foreground mt-2">No organization assigned to your profile yet. Actions are available, but metrics will load after your org is set.</p>
          )}
        </header>

        <main className="space-y-8">
          <section aria-labelledby="admin-actions">
            <h2 id="admin-actions" className="sr-only">Admin actions</h2>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperadmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
              <Button variant="outline" className="bg-white h-auto py-3 px-4 w-full flex items-center justify-start text-left" onClick={() => setIsAddUserOpen(true)}>
                <UserPlus className="mr-3 h-5 w-5 text-blue-500" />
                <span className="font-semibold">Create new Users</span>
              </Button>
              <Button variant="outline" className="bg-white h-auto py-3 px-4 w-full flex items-center justify-start text-left" onClick={() => setIsAddLocationOpen(true)}>
                <MapPin className="mr-3 h-5 w-5 text-blue-500" />
                <span className="font-semibold">Create new Locations</span>
              </Button>
              <Button variant="outline" className="bg-white h-auto py-3 px-4 w-full flex items-center justify-start text-left" onClick={() => setIsAddPartnerOpen(true)}>
                <Handshake className="mr-3 h-5 w-5 text-blue-500" />
                <span className="font-semibold">Add new Partner</span>
              </Button>
              <Button variant="outline" className="bg-white h-auto py-3 px-4 w-full flex items-center justify-start text-left" onClick={() => {
                const hideDialog = localStorage.getItem('hideSharingCodeRequirementsDialog');
                if (hideDialog === 'true') {
                  setIsGetCodeOpen(true);
                } else {
                  setIsRequirementsOpen(true);
                }
              }}>
                <Share2 className="mr-3 h-5 w-5 text-blue-500" />
                <span className="font-semibold">Create Sharing Code</span>
              </Button>
              {isSuperadmin && (
                <Button variant="outline" className="bg-white h-auto py-3 px-4 w-full flex items-center justify-start text-left" onClick={() => setIsMatrixExporterOpen(true)}>
                  <Settings className="mr-3 h-5 w-5 text-blue-500" />
                  <span className="font-semibold">Matrix Exporter</span>
                </Button>
              )}
            </div>
          </section>

          <section aria-labelledby="admin-metrics">
            <h2 id="admin-metrics" className="sr-only">Admin metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} title="# of Users" value={counts.users} loading={loadingCounts} />
              <StatCard icon={Award} title="# of Admin Users" value={counts.admins} loading={loadingCounts} />
              <StatCard icon={MapPin} title="# of Locations" value={counts.locations} loading={loadingCounts} />
              <StatCard icon={Handshake} title="# of Partners" value={counts.partners} loading={loadingCounts} />
            </div>
          </section>

          <section className="space-y-6" aria-label="updates">
            {loadingNotifications ? (
              <div>
                <h2 className="text-xl font-medium text-muted-foreground mb-4">Notifications</h2>
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <Notifications notifications={(notifications || []).map(n => {
                const md = n.metadata || {};
                const partnerId = md.partner_connection_id || md.partner_id;
                const details = (
                  n.type === 'partner_invite'
                    ? [md.inviter_org_name && `From: ${md.inviter_org_name}`, md.partner_location && `Location: ${md.partner_location}`].filter(Boolean).join(' · ')
                    : n.type === 'partner_status'
                    ? [md.partner_org_name && `Partner: ${md.partner_org_name}`, md.status && `Status: ${md.status}`].filter(Boolean).join(' · ')
                    : n.type === 'partner_share_update'
                    ? [md.brand_org_name && `Brand: ${md.brand_org_name}`, md.tag_name && `Tag: ${md.tag_name}`, md.shared_count && `Colors: ${md.shared_count}`].filter(Boolean).join(' · ')
                    : ''
                );
                return {
                  id: n.id,
                  icon: Bell,
                  iconColor: 'text-blue-500',
                  title: n.title || 'Notification',
                  description: details || n.message || '',
                  time: n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : '',
                  onView: () => navigate(`/admin/partners${partnerId ? `?partnerId=${partnerId}` : ''}`),
                  onDismiss: () => {}
                };
              })} />
            )}

            <div>
              <h2 className="text-xl font-medium text-muted-foreground mb-4">Recent Activity</h2>
              {activitiesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <RecentActivityTable activities={recentActivities} />
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Dialogs */}
      <AddUserDialog isOpen={isAddUserOpen} setIsOpen={setIsAddUserOpen} onUserAdded={refetchAll} />
      <AddLocationDialog isOpen={isAddLocationOpen} setIsOpen={setIsAddLocationOpen} organizationId={orgId} onLocationAdded={refetchAll} />
      <AddPartnerWizard open={isAddPartnerOpen} onOpenChange={setIsAddPartnerOpen} onInvite={refetchAll} />
      <SharingCodeRequirementsDialog 
        open={isRequirementsOpen}
        onOpenChange={setIsRequirementsOpen}
        onProceed={() => setIsGetCodeOpen(true)}
      />
      <GetSharingCodeDialog isOpen={isGetCodeOpen} setIsOpen={setIsGetCodeOpen} organization={organization} locations={locations} />
      
      <Dialog open={isMatrixExporterOpen} onOpenChange={setIsMatrixExporterOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Match Status Matrix Exporter</DialogTitle>
          </DialogHeader>
          <MatrixExporter />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminDashboard;
