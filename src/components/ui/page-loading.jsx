import React from 'react';
import { Loader2 } from 'lucide-react';

// Minimal loading component for page transitions
export const PageLoading = () => (
  <div className="flex items-center justify-center h-64 bg-white">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

// Enhanced progressive loader with better UX
export const ProgressivePageLoader = ({ delay = 150, children }) => {
  const [showLoader, setShowLoader] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!showLoader) {
    return null; // Show nothing for brief loads
  }

  return children || <PageLoading />;
};

export default PageLoading;