import React from 'react';
import Sidebar from '@/components/Sidebar';
import AppHeader from '@/components/AppHeader';
import { useNavMemory } from '@/hooks/useNavMemory';

const AuthLayout = ({ children }) => {
  // Initialize navigation memory safely - hook now has error handling
  const navMemory = useNavMemory();
  
  return (
    <div className="h-[100dvh] bg-app-bg font-sans text-foreground flex overflow-hidden overscroll-none">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <AppHeader />
        <main className="flex-1 p-[3px] overflow-y-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AuthLayout;