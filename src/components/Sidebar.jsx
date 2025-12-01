import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Droplets,
  Award,
  Users,
  Building,
  Book,
  Printer,
  PaintBucket,
  Layers,
  Spline,
  Target,
  FileText,
  HeartHandshake as Handshake,
  Activity,
  Puzzle,
  Briefcase,
  GitPullRequestArrow,
  ClipboardList,
  Grid3X3
} from 'lucide-react';
import ModeSwitcher from '@/components/ModeSwitcher';
import { useAppContext } from '@/context/AppContext';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/lib/customSupabaseClient';
import { withLogoVersion } from '@/lib/logoUtils';



const navConfig = {
    matching: [
        { icon: LayoutDashboard, label: 'Matching Dashboard', path: '/dashboard' },
        { icon: Book, label: 'Colors', path: '/colors' },
        { icon: Droplets, label: 'Matching Jobs', path: '/color-matches' },
        { icon: ClipboardList, label: 'Print Conditions', path: '/print-conditions' },
        { icon: Award, label: 'Quality Sets', path: '/quality-sets' },
        { icon: Activity, label: 'Activity', path: '/activity' },
    ],
    admin: [
        { icon: LayoutDashboard, label: 'Admin Dashboard', path: '/admin/dashboard' },
        { icon: Building, label: 'My Company', path: '/admin/my-company' },
        { icon: Users, label: 'Users', path: '/admin/users' },
        { icon: Briefcase, label: 'Organizations', path: '/admin/organizations' },
        { icon: Handshake, label: 'Partners', path: '/admin/partners' },
        { icon: Puzzle, label: 'Integrations', path: '/admin/integrations' },
    ],
    assets: [
        { icon: LayoutDashboard, label: 'Printing Dashboard', path: '/assets/dashboard' },
        { icon: Printer, label: 'Printers (Coming Soon)', path: '/assets/printers' },
        { icon: PaintBucket, label: 'Inks', path: '/assets/inks' },
        { icon: Layers, label: 'Substrates', path: '/assets/substrates' },
        
        { icon: GitPullRequestArrow, label: 'Test Charts', path: '/assets/testcharts' },
        { icon: Spline, label: 'Curves (Coming Soon)', path: '/assets/curves' },
        { icon: Target, label: 'Characterizations (Coming Soon)', path: '/assets/characterizations' },
        { icon: FileText, label:'Profiles (Coming Soon)', path: '/assets/profiles' },
    ],
};

// Transient routes that should not be remembered in navigation
const transientRoutes = ['/match-request/new', '/match-request/wizard'];

// Determine which nav group a path belongs to
const whichGroupForPath = (path) => {
  if (!path) return null;
  for (const [group, items] of Object.entries(navConfig)) {
    if (items.some(i => path.startsWith(i.path))) return group;
  }
  return null;
};

// Validate a path for a given group
const isValidPathForGroup = (path, group) => {
  if (!path || !group || !navConfig[group]) return false;
  return navConfig[group].some(item => path.startsWith(item.path));
};

const SidebarLink = ({ item, onClick }) => {
  const renderLabel = (label) => {
    if (label.includes('(Coming Soon)')) {
      const [mainText, comingSoonText] = label.split(' (Coming Soon)');
      return (
        <span className="flex flex-col leading-none">
          <span>{mainText}</span>
          <span className="italic text-xs opacity-70">(Coming Soon)</span>
        </span>
      );
    }
    return label;
  };

  return (
    <NavLink
      to={item.path}
      onClick={() => onClick(item.path)}
      end={item.path === '/' || item.path.endsWith('dashboard')}
      className={({ isActive }) =>
        `flex items-center py-2.5 text-sm font-medium transition-all duration-300 ease-out relative ${
          isActive
            ? 'pl-4 pr-4 mr-4 bg-accent text-accent-foreground rounded-r-lg'
            : 'text-muted-foreground hover:bg-muted/50 mx-4 px-4 rounded-lg'
        }`
      }
    >
      {({isActive}) => (
        <>
          {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-primary" />}
          <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="flex-1">
            {renderLabel(item.label)}
          </span>
        </>
      )}
    </NavLink>
  );
};

const Sidebar = () => {
  const { appMode, setAppMode, navGroupSelections, setNavGroupSelections } = useAppContext();
  const location = useLocation();
  const { profile } = useProfile();
  
  // Role access
  const roleStr = (profile?.role || '').toLowerCase();
  const isSuperadmin = roleStr === 'superadmin' || roleStr === 'super admin';
  const canSeeAdmin = isSuperadmin || roleStr === 'admin';
  
  const [logoUrl, setLogoUrl] = useState(null);

  // Filter nav items based on user role and licensing
  const getFilteredNavItems = () => {
    let items = navConfig[appMode] || navConfig.matching;
    
    // Only show Organizations for Superadmin users
    if (appMode === 'admin' && profile?.role !== 'Superadmin') {
      items = items.filter(item => item.path !== '/admin/organizations');
    }
    
    // Hide specific categories for all roles except Superadmin
    if (appMode === 'assets' && !isSuperadmin) {
      const restrictedPaths = [
        '/assets/printers',
        '/assets/testcharts',
        '/assets/curves',
        '/assets/characterizations',
        '/assets/profiles'
      ];
      items = items.filter(item => !restrictedPaths.includes(item.path));
    }
    
    // Hide Print Conditions and Quality Sets (licensing check temporarily disabled here)
    if (appMode === 'matching') {
      const isBrandOwner = profile?.organization?.type?.includes('Brand Owner');
      const isLibrariesFree = false; // licensing resolved elsewhere
      if (isLibrariesFree && !isBrandOwner) {
        items = items.filter(item => 
          item.path !== '/print-conditions' && 
          item.path !== '/quality-sets'
        );
      }
    }
    
    return items;
  };

  const navItems = getFilteredNavItems();

useEffect(() => {
    // Record navigation for the current group
    if (!location?.pathname) return;
    handleLinkClick(location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const loadLogo = async () => {
      try {
        if (!profile?.organization_id) return;
        const { data, error } = await supabase
          .from('organizations')
          .select('logo_url')
          .eq('id', profile.organization_id)
          .maybeSingle();
        if (error) {
          console.warn('Sidebar: logo fetch error', error);
        }
        setLogoUrl(withLogoVersion(data?.logo_url || null, profile.organization_id));
      } catch (e) {
        console.warn('Sidebar: logo fetch failed', e);
      }
    };
    loadLogo();
  }, [profile?.organization_id]);

  useEffect(() => {
    const handler = (e) => {
      if (e?.detail) setLogoUrl(e.detail);
    };
    window.addEventListener('org-logo-updated', handler);
    return () => window.removeEventListener('org-logo-updated', handler);
  }, []);

  const handleLinkClick = (path) => {
    // Don't store transient routes in navigation memory
    if (transientRoutes.some(route => path.includes(route))) return;

    const group = whichGroupForPath(path);
    // Only store if path is valid for the determined group
    if (group && isValidPathForGroup(path, group) && navGroupSelections?.[group] !== path) {
      setNavGroupSelections(prev => ({
        ...prev,
        [group]: path,
      }));
    }
  }

  return (
    <div className="w-64 bg-sidebar flex flex-col border-r border-border/50">
      <div className="h-16 px-4 bg-background border-b border-border/50 flex items-center justify-start">
        {logoUrl ? (
          <img alt="Company logo" className="h-12 max-h-12 w-auto object-contain object-left" src={logoUrl} />
        ) : (
          <div className="h-12 flex items-center">
            <p className="text-sm text-muted-foreground italic">
              Add your logo from{' '}
              <Link 
                to="/admin/my-company" 
                className="font-bold hover:underline"
                onClick={() => setAppMode('admin')}
              >
                Admin/MyCompany
              </Link>
            </p>
          </div>
        )}
      </div>

      <nav className="flex-grow space-y-1 py-4">
        {navItems.map((item) => (
          <SidebarLink key={item.path} item={item} onClick={handleLinkClick} />
        ))}
      </nav>

      <div className="mt-auto">
        <ModeSwitcher />
      </div>
    </div>
  );
};

export default Sidebar;