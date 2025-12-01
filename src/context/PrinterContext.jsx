import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';

const PrinterContext = createContext();

export const usePrinterData = () => {
  const context = useContext(PrinterContext);
  if (!context) {
    console.error('usePrinterData must be used within a PrinterProvider');
    return { printers: [], loading: false, error: null, refetch: async () => {} };
  }
  return context;
};

export const PrinterProvider = ({ children }) => {
  // Add safety check for ProfileProvider availability
  let profile, profileLoading;
  try {
    const profileData = useProfile();
    profile = profileData?.profile;
    profileLoading = profileData?.loading;
  } catch (error) {
    console.error('PrinterProvider: Failed to access ProfileContext:', error);
    // Provide fallback values when ProfileProvider is not available
    profile = null;
    profileLoading = true;
  }
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPrinters = useCallback(async (organizationId) => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch print conditions with enhanced data
      const { data: printConditions, error: printConditionsError } = await supabase
        .from('print_conditions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (printConditionsError) {
        throw printConditionsError;
      }

      // Fetch inks to map to conditions
      const { data: inks } = await supabase
        .from('inks')
        .select('id, name, print_process')
        .eq('organization_id', organizationId);

      // Group print conditions by print process to create "virtual printers"
      const printerMap = new Map();
      
      printConditions.forEach(condition => {
        const printProcess = condition.print_process || 'Unknown';
        
        if (!printerMap.has(printProcess)) {
          printerMap.set(printProcess, {
            id: `printer-${printProcess.toLowerCase().replace(/\s+/g, '-')}`,
            name: `${printProcess} Printer`,
            type: printProcess,
            print_process: printProcess,
            calibrated: false,
            lastCalibrationDate: null,
            conditions: []
          });
        }
        
        // Get related inks for this condition
        const relatedInks = inks?.filter(ink => ink.print_process === printProcess) || [];
        
        printerMap.get(printProcess).conditions.push({
          id: condition.id,
          name: condition.name,
          pack_type: condition.pack_type,
          lastEdited: condition.updated_at ? new Date(condition.updated_at).toLocaleDateString() : 'N/A',
          substrate_name: condition.substrate_name || 'Unknown Substrate',
          substrate_condition: condition.substrate_condition || null,
          inks: relatedInks.map(ink => ({ id: ink.id, name: ink.name })),
          calibration: condition.calibration || { status: null },
          last_calibration_date: condition.last_calibration_date || null
        });
      });

      // Convert map to array and update calibration status
      const printersArray = Array.from(printerMap.values()).map(printer => {
        const calibratedConditions = printer.conditions.filter(c => 
          c.calibration?.status === 'complete'
        );
        
        printer.calibrated = calibratedConditions.length === printer.conditions.length && printer.conditions.length > 0;
        
        const calibrationDates = printer.conditions
          .map(c => c.last_calibration_date)
          .filter(date => date)
          .sort((a, b) => new Date(b) - new Date(a));
        
        printer.lastCalibrationDate = calibrationDates[0] ? 
          new Date(calibrationDates[0]).toLocaleDateString() : null;
        
        return printer;
      });

      setPrinters(printersArray);

    } catch (err) {
      console.error("Error fetching printer data:", err);
      setError(err.message);
      setPrinters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profileLoading && profile?.organization_id) {
      fetchPrinters(profile.organization_id);
    } else if (!profileLoading && !profile) {
      setLoading(false);
      setPrinters([]);
    }
  }, [profile, profileLoading, fetchPrinters]);

  const refetch = useCallback(() => {
    if (profile?.organization_id) {
      fetchPrinters(profile.organization_id);
    }
  }, [profile?.organization_id, fetchPrinters]);

  const value = {
    printers,
    loading,
    error,
    refetch
  };

  return (
    <PrinterContext.Provider value={value}>
      {children}
    </PrinterContext.Provider>
  );
};