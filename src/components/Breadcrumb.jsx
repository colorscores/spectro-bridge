import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';

const breadcrumbNameMap = {
  'assets': 'Assets',
  'dashboard': 'Asset Dashboard',
  'colors': 'Colors',
  'printers': 'Printers',
  'inks': 'Inks',
  'substrates': 'Substrates',
  'curves': 'Curves',
  'characterizations': 'Characterizations',
  'profiles': 'Profiles',
  'admin': 'Admin',
  'integrations': 'Integrations',
  'my-company': 'My Company',
  'users': 'Users',
  'partners': 'Partners',
  'color-matches': 'Matching Jobs',
  'quality-sets': 'Quality Sets',
  'activity': 'Activity',
  'matching': 'Matching',
};

const modeConfig = {
    assets: { label: 'Printing Assets', path: '/assets/dashboard' },
    matching: { label: 'Colors & Matching', path: '/color-matches' },
    admin: { label: 'Admin', path: '/admin/my-company' },
};

const Breadcrumb = ({ items, children }) => {
  const location = useLocation();
  const { appMode } = useAppContext();

  if (items) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between text-sm text-muted-foreground mb-2 sm:mb-3"
      >
        <div className="flex items-center">
          {items.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
              {item.href ? (
                <Link to={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
        {children}
      </motion.div>
    );
  }

  const pathnames = location.pathname.split('/').filter((x) => x);

  const getBreadcrumbName = (segment, index) => {
    if (breadcrumbNameMap[segment]) {
      return breadcrumbNameMap[segment];
    }
    // This part is now handled by the specific items prop from Matching.jsx
    // if (index > 0 && pathnames[index-1] === 'color-matches') {
    //     const requests = JSON.parse(localStorage.getItem('colorMatchRequests') || '[]');
    //     const request = requests.find(r => r.id.toString() === segment);
    //     return request ? `Request #${request.id}` : `Match ${segment}`;
    // }
     if (index > 0 && pathnames[index-1] === 'brand-colors') {
        return `Color ${segment}`;
    }
     if (index > 0 && pathnames[index-1] === 'substrates') {
        const structuresData = [
            { id: 'pt2', name: 'Shrink Sleeve' },
            { id: 'pt3', name: 'Corrugated Box' },
            { id: 'pt4', name: 'Folding Carton' },
        ];
        const structure = structuresData.find(s => s.id === segment);
        return structure ? structure.name : `Detail ${segment}`;
     }
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  const rootConfig = modeConfig[appMode] || { label: 'Matching', path: '/' };
  
  if (location.pathname === '/' || location.pathname === '/assets/dashboard' || location.pathname === '/admin/my-company' || location.pathname === '/color-matches' || location.pathname === '/quality-sets' || location.pathname === '/activity') {
    let pageTitle = 'Matching Dashboard';
    if (location.pathname === '/assets/dashboard') pageTitle = 'Asset Dashboard';
    if (location.pathname === '/admin/my-company') pageTitle = 'My Company';
    if (location.pathname === '/color-matches') pageTitle = 'Matching Jobs';
    if (location.pathname === '/quality-sets') pageTitle = 'Quality Sets';
    if (location.pathname === '/activity') pageTitle = 'Activity';

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between mb-2 sm:mb-3"
      >
        <div className="flex items-center text-2xl font-bold text-gray-900">
          <span>{pageTitle}</span>
        </div>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between mb-2 sm:mb-3"
    >
      <div className="flex items-center text-2xl font-bold text-gray-900">
        {/* Show root based on app mode; only hide when browsing assets subtree */}
        {!(pathnames[0] === 'assets') && (
          <Link to={rootConfig.path} className="text-gray-500 hover:text-gray-900">{rootConfig.label}</Link>
        )}
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const displayName = getBreadcrumbName(value, index);

          if (index === 0 && (value === 'assets' || value === 'admin' || value === 'color-matches')) {
            return null;
          }

          // Skip "Color Assets" for substrates, inks, colors, and printers pages
          if (index === 0 && value === 'assets' && (pathnames.includes('substrates') || pathnames.includes('inks') || pathnames.includes('colors') || pathnames.includes('printers'))) {
            return null;
          }

          const shouldShowArrow = (pathnames[0] !== 'assets') ? true : index > 1;

          return (
            <React.Fragment key={to}>
              {shouldShowArrow && <ChevronRight className="h-5 w-5 mx-2 text-gray-400" />}
              {isLast ? (
                <span>{displayName}</span>
              ) : (
                <Link to={to} className="text-gray-500 hover:text-gray-900">{displayName}</Link>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {children}
    </motion.div>
  );
};

export default Breadcrumb;