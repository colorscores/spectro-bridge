import React from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Palette, Settings, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoleAccess } from '@/hooks/useRoleAccess';

const modes = [
  { id: 'matching', label: 'Colors & Matching', icon: Palette },
  { id: 'assets', label: 'Printing Assets', icon: Package },
  { id: 'admin', label: 'Admin', icon: Settings },
];

const ModeSwitcher = () => {
  const { appMode, setAppMode } = useAppContext();
  const { canSeeAdmin, canSeePrintingAssets } = useRoleAccess();
  
  const handleModeChange = (newMode) => {
    // Simply change the app mode - the useNavMemory hook will handle 
    // the first-visit logic and navigation automatically
    setAppMode(newMode);
  };

  // Filter modes based on user role
  const availableModes = modes.filter(mode => {
    if (mode.id === 'admin') return canSeeAdmin;
    if (mode.id === 'assets') return canSeePrintingAssets;
    return true; // 'matching' is always available
  });

  return (
    <div className="flex flex-col space-y-1 w-full p-4">
      {availableModes.map((mode) => (
        <Button
          key={mode.id}
          variant="ghost"
          className={cn(
            "w-full justify-start text-sm font-medium",
            appMode === mode.id 
              ? 'text-switcher-active-text'
              : 'text-switcher-inactive-text',
            'hover:bg-transparent hover:text-switcher-active-text'
          )}
          onClick={() => handleModeChange(mode.id)}
        >
          <mode.icon className="mr-3 h-5 w-5" />
          {mode.label}
        </Button>
      ))}
    </div>
  );
};

export default ModeSwitcher;