import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Printer, Beaker, FileText, Wrench, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import RecentActivityTable from '@/components/dashboard/RecentActivityTable';
import Notifications from '@/components/dashboard/Notifications';
import { useProfile } from '@/context/ProfileContext';
import { useAppContext } from '@/context/AppContext';
import { useInksData } from '@/context/InkContext';
import { useSubstratesData } from '@/context/SubstrateContext';
import { usePrinterData } from '@/context/PrinterContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
// import { useActivityData } from '@/hooks/useActivityData';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/customSupabaseClient';

const ActionButton = ({ icon: Icon, text, onClick }) => {
  return (
    <Button variant="outline" className="bg-white h-auto py-3 px-4 w-full flex items-center justify-start text-left" onClick={onClick}>
      <Icon className="h-5 w-5 mr-3 text-blue-500" />
      <span className="font-semibold">{text}</span>
    </Button>
  );
};

const DashboardStatCard = ({ icon: Icon, title, value, loading }) => (
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
          <Skeleton className="h-9 w-16" />
        ) : (
          <div className="text-4xl font-bold">{value}</div>
        )}
      </div>
    </CardContent>
  </Card>
);

const AssetDashboard = () => {
  const { profile, loading: profileLoading } = useProfile();
  const { colors, loading: assetsLoading } = useAppContext();
  const { allInks, loading: inksLoading } = useInksData();
  const { substrates, loading: substratesLoading } = useSubstratesData();
  const { printers, loading: printersLoading } = usePrinterData();
  const { isSuperadmin } = useRoleAccess();
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(' ')[0] || '';
  const activities = []; const activitiesLoading = false; const activitiesError = null;

  const [uncalibratedCount, setUncalibratedCount] = React.useState(0);
  const [uncalibratedLoading, setUncalibratedLoading] = React.useState(true);

  // Get the last 4 activities for the dashboard
  const recentActivities = (activities || []).slice(0, 4).map(activity => ({
    description: activity.details || activity.activity,
    action: activity.activity,
    user: activity.user,
    company: activity.company,
    details: activity.receiver !== '-' ? `To: ${activity.receiver}` : '',
    date: activity.date,
  }));

  React.useEffect(() => {
    const fetchUncalibrated = async () => {
      if (!profile?.organization_id) {
        setUncalibratedLoading(false);
        return;
      }
      setUncalibratedLoading(true);
      const { count, error } = await supabase
        .from('print_conditions')
        .select('id', { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .limit(0)
        .or('calibration.is.null,calibration->>status.neq.complete');
      if (!error) setUncalibratedCount(count || 0);
      setUncalibratedLoading(false);
    };
    fetchUncalibrated();
  }, [profile?.organization_id]);
  const actionButtons = [
    ...(isSuperadmin ? [{ 
      icon: Printer, 
      text: "Add printer", 
      onClick: () => navigate('/assets/printers/new')
    }] : []),
    { 
      icon: Beaker, 
      text: "Add ink", 
      onClick: () => navigate('/assets/inks/new')
    },
    { 
      icon: FileText, 
      text: "Add substrate", 
      onClick: () => navigate('/assets/substrates/new')
    },
    ...(isSuperadmin ? [{ 
      icon: Wrench, 
      text: "Calibrate printer", 
      onClick: () => navigate('/assets/printers?calibration=uncalibrated')
    }] : []),
  ];

  const stats = [
    ...(isSuperadmin ? [{ title: "# of printers", value: printers?.length || 0, icon: Printer, loading: printersLoading }] : []),
    { title: "# of inks", value: allInks?.length || 0, icon: Beaker, loading: inksLoading },
    { title: "# of substrates", value: substrates?.length || 0, icon: FileText, loading: substratesLoading },
    ...(isSuperadmin ? [{ title: "# of uncalibrated printer conditions", value: uncalibratedCount || 0, icon: AlertTriangle, loading: uncalibratedLoading }] : []),
  ];

  return (
    <>
      <Helmet>
        <title>Printing Dashboard - Spectral</title>
        <meta name="description" content="Your printing operations at a glance." />
      </Helmet>
      <div className="space-y-8 p-4 md:p-8 pt-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-gray-800">
            {profileLoading ? <Skeleton className="h-9 w-48" /> : `Hi ${firstName}.`}
          </h1>
          <p className="text-lg text-gray-600">Here are your color matching assets at a glance.</p>
        </motion.div>

        <motion.div 
          className={`grid grid-cols-1 sm:grid-cols-2 ${actionButtons.length > 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {actionButtons.map((btn, index) => (
            <ActionButton key={index} icon={btn.icon} text={btn.text} onClick={btn.onClick} />
          ))}
        </motion.div>

        <motion.div 
          className={`grid grid-cols-1 sm:grid-cols-2 ${stats.length > 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-6`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {stats.map((stat, index) => (
            <DashboardStatCard key={index} {...stat} />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
            <Notifications />
        </motion.div>

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
        >
            <h2 className="text-xl font-medium text-gray-600 mb-4">Recent Activity</h2>
            <RecentActivityTable activities={recentActivities} />
        </motion.div>
      </div>
    </>
  );
};

export default AssetDashboard;