import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { computeDisplayColorFromSpectral } from '@/lib/colorUtils';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { calculateDeltaE } from '@/lib/deltaE';

const MobileMatchApproval = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenHash, setTokenHash] = useState(null);
  
  const { astmTables, loading: astmLoading } = useAstmTablesCache();

  useEffect(() => {
    validateToken();
  }, [token]);

  const hashToken = async (tokenString) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(tokenString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Helpers for spectral data normalization
  const normalizeModeKey = (key) => {
    if (!key) return '';
    return key.toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  const buildNormalizedMap = (spectralDataObj) => {
    if (!spectralDataObj || typeof spectralDataObj !== 'object') return {};
    const map = {};
    Object.keys(spectralDataObj).forEach(key => {
      const normalized = normalizeModeKey(key);
      map[normalized] = spectralDataObj[key];
    });
    return map;
  };

  const selectReferenceSpectral = (colorSpectralData, modeKey) => {
    if (!colorSpectralData || typeof colorSpectralData !== 'object') {
      console.debug('[MobileMatchApproval] No color_spectral_data available');
      return null;
    }

    const normalizedMap = buildNormalizedMap(colorSpectralData);
    const availableKeys = Object.keys(normalizedMap);
    console.debug('[MobileMatchApproval] Available spectral keys (normalized):', availableKeys);

    const normalizedMode = normalizeModeKey(modeKey);
    console.debug('[MobileMatchApproval] Looking for mode:', modeKey, '-> normalized:', normalizedMode);

    // Try exact normalized match
    if (normalizedMode && normalizedMap[normalizedMode]) {
      console.debug('[MobileMatchApproval] ✓ Found exact match for:', normalizedMode);
      return normalizedMap[normalizedMode];
    }

    // Fallback to standard modes in order
    const fallbackModes = ['M0', 'M1', 'M2', 'M3'];
    for (const mode of fallbackModes) {
      if (normalizedMap[mode]) {
        console.debug('[MobileMatchApproval] ✓ Using fallback mode:', mode);
        return normalizedMap[mode];
      }
    }

    // Last resort: use first available
    const firstKey = availableKeys[0];
    if (firstKey) {
      console.debug('[MobileMatchApproval] ⚠ Using first available key:', firstKey);
      return normalizedMap[firstKey];
    }

    console.debug('[MobileMatchApproval] ✗ No spectral data found');
    return null;
  };

  const computeColorsAndDeltaE = (refSpectral, sampleSpectral, illuminant, observer, astmTableNumber, astmTables, defaultDeltaEMethod) => {
    console.log('[MOBILE computeColorsAndDeltaE] Called with:', {
      hasRefSpectral: !!refSpectral,
      hasSampleSpectral: !!sampleSpectral,
      refSpectralPreview: refSpectral ? Object.keys(refSpectral).slice(0, 3).map(k => `${k}:${refSpectral[k]}`) : null,
      sampleSpectralPreview: sampleSpectral ? Object.keys(sampleSpectral).slice(0, 3).map(k => `${k}:${sampleSpectral[k]}`) : null,
      astmTablesCount: astmTables?.length || 0,
      illuminant,
      observer,
      astmTableNumber,
      deltaEMethod: defaultDeltaEMethod
    });
    
    // Safety checks with detailed logging
    if (!refSpectral) console.warn('[MOBILE-APPROVAL] Missing refSpectral:', refSpectral);
    if (!sampleSpectral) console.warn('[MOBILE-APPROVAL] Missing sampleSpectral:', sampleSpectral);
    if (!astmTables?.length) console.warn('[MOBILE-APPROVAL] Missing astmTables, length:', astmTables?.length);
    
    if (!refSpectral || !sampleSpectral || !astmTables?.length) {
      console.warn('[MOBILE computeColorsAndDeltaE] Missing required data, returning fallback');
      return { refHex: '#CCCCCC', sampleHex: '#CCCCCC', deltaE: 'N/A' };
    }

    const refResult = computeDisplayColorFromSpectral(refSpectral, illuminant, observer, astmTableNumber, astmTables);
    const sampleResult = computeDisplayColorFromSpectral(sampleSpectral, illuminant, observer, astmTableNumber, astmTables);

    console.log('[MOBILE Lab Computation]:', {
      refLab: refResult?.lab,
      sampleLab: sampleResult?.lab,
      refHex: refResult?.hex,
      sampleHex: sampleResult?.hex
    });

    if (!refResult || !sampleResult) {
      return { refHex: '#CCCCCC', sampleHex: '#CCCCCC', deltaE: 'N/A' };
    }

    // Use the organization's default Delta E method (or fallback to dE76)
    const deltaEMethod = defaultDeltaEMethod || 'dE76';
    const rawDeltaE = calculateDeltaE(refResult.lab, sampleResult.lab, deltaEMethod);
    const roundedDeltaE = rawDeltaE !== null ? Number(rawDeltaE.toFixed(2)) : null;
    
    console.log('[MOBILE DeltaE Calculation] 🔴 CRITICAL DEBUG:', {
      method: deltaEMethod,
      refLab: refResult.lab,
      sampleLab: sampleResult.lab,
      rawDeltaE: rawDeltaE,
      roundedDeltaE: roundedDeltaE,
      finalDisplay: roundedDeltaE !== null ? roundedDeltaE.toFixed(2) : 'N/A'
    });

    return {
      refHex: refResult.hex,
      sampleHex: sampleResult.hex,
      deltaE: roundedDeltaE !== null ? roundedDeltaE.toFixed(2) : 'N/A'
    };
  };

  // Validate token and get full data in one call
  const validateTokenAndGetData = async (hash) => {
    const { data, error } = await supabase.rpc('get_measurement_for_approval', {
      token_hash_input: hash
    });
    
    if (error) throw error;
    return data;
  };

  const validateToken = async () => {
    if (!token) {
      setTokenError('No approval token provided');
      setLoading(false);
      return;
    }

    try {
      const hash = await hashToken(token);
      setTokenHash(hash);

      // Validate token and get full data in one call
      const result = await validateTokenAndGetData(hash);

      if (!result || result.length === 0) {
        setTokenError('Link invalid, expired, or already used.');
        setLoading(false);
        return;
      }

      const data = result[0];
      
      console.log('📋 Approval data received:', data);

      // Store all the data we need
      setMatchData(data);
      setTokenValid(true);
      setLoading(false);

    } catch (err) {
      console.error('Token validation error:', err);
      setTokenError(err.message || 'Failed to validate approval token');
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      // Use the new RPC function that works without auth
      const { data, error } = await supabase.rpc('approve_match_with_token', { 
        p_token: token 
      });

      console.log('✅ Approval response:', { data, error });

      if (error) {
        throw new Error(error.message);
      }
        
      setSuccess(true);
      toast({
        title: 'Match Approved',
        description: 'The match has been successfully approved.',
      });
    } catch (err) {
      console.error('Approval error:', err);
      toast({
        title: 'Approval Failed',
        description: err.message || 'Failed to approve match',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      // Use the new RPC function that works without auth
      const { data, error } = await supabase.rpc('reject_match_with_token', { 
        p_token: token 
      });

      console.log('❌ Rejection response:', { data, error });

      if (error) {
        throw new Error(error.message);
      }
        
      setSuccess(true);
      toast({
        title: 'Match Rejected',
        description: 'The match has been rejected.',
      });
    } catch (err) {
      console.error('Rejection error:', err);
      toast({
        title: 'Rejection Failed',
        description: err.message || 'Failed to reject match',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Show loading state - wait for ASTM tables to actually load
  if (loading || astmLoading || !astmTables || astmTables.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border rounded-lg p-6 text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Link</h1>
          <p className="text-muted-foreground mb-4">{tokenError}</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border rounded-lg p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Success!</h1>
          <p className="text-muted-foreground mb-4">
            Your decision has been recorded successfully.
          </p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!tokenValid || !matchData) {
    return null;
  }

  const colorName = matchData.color_name || 'N/A';
  const jobId = matchData.job_id || matchData.job_reference || matchData.job_number || 'N/A';
  const location = matchData.match_location || 'N/A';
  const qualitySetName = matchData.quality_set_name || 'N/A';
  
  // Debug logging before computation
  console.log('[MOBILE-APPROVAL] Pre-computation debug:', {
    'color_spectral_data type': typeof matchData.color_spectral_data,
    'color_spectral_data keys': matchData.color_spectral_data ? Object.keys(matchData.color_spectral_data) : 'null',
    'color_spectral_data preview': matchData.color_spectral_data ? JSON.stringify(matchData.color_spectral_data).substring(0, 200) : 'null',
    'spectral_data type': typeof matchData.spectral_data,
    'spectral_data keys': matchData.spectral_data ? Object.keys(matchData.spectral_data).length : 'null',
    'astmTables length': astmTables?.length || 0,
    'quality_set_mode': matchData.quality_set_mode,
    'illuminant': matchData.quality_set_illuminant,
    'observer': matchData.quality_set_observer,
    'table': matchData.quality_set_table,
    'default_delta_e': matchData.default_delta_e
  });
  
  // Parse JSON strings if needed (defensive coding for JSONB coming as strings)
  let colorSpectralData = matchData.color_spectral_data;
  if (typeof colorSpectralData === 'string') {
    try {
      colorSpectralData = JSON.parse(colorSpectralData);
      console.log('[MOBILE-APPROVAL] Parsed color_spectral_data from string');
    } catch (e) {
      console.warn('[MOBILE-APPROVAL] Failed to parse color_spectral_data:', e);
    }
  }

  let sampleSpectralData = matchData.spectral_data;
  if (typeof sampleSpectralData === 'string') {
    try {
      sampleSpectralData = JSON.parse(sampleSpectralData);
      console.log('[MOBILE-APPROVAL] Parsed spectral_data from string');
    } catch (e) {
      console.warn('[MOBILE-APPROVAL] Failed to parse spectral_data:', e);
    }
  }

  // Use quality set mode with robust fallback logic
  const modeKey = matchData.quality_set_mode;
  const referenceSpectral = selectReferenceSpectral(colorSpectralData, modeKey);
  const sampleSpectral = sampleSpectralData;

  console.log('[MOBILE-APPROVAL] Selected reference spectral:', {
    'has referenceSpectral': !!referenceSpectral,
    'referenceSpectral keys': referenceSpectral ? Object.keys(referenceSpectral).length : 0,
    'has sampleSpectral': !!sampleSpectral,
    'sampleSpectral keys': sampleSpectral ? Object.keys(sampleSpectral).length : 0
  });

  const astmTableNumber = matchData.quality_set_table || matchData.default_astm_table || '5';
  const illuminant = matchData.quality_set_illuminant || matchData.default_illuminant || 'D50';
  const observer = matchData.quality_set_observer || matchData.default_observer || '2';

  console.log('[MobileMatchApproval] Using spectral data:', {
    modeKey,
    hasReferenceSpectral: !!referenceSpectral,
    hasSampleSpectral: !!sampleSpectral,
    refKeys: referenceSpectral ? Object.keys(referenceSpectral).slice(0, 5) : [],
    sampleKeys: sampleSpectral ? Object.keys(sampleSpectral).slice(0, 5) : [],
    illuminant,
    observer,
    astmTableNumber
  });

  console.log('[MobileMatchApproval] arg sanity', {
    illuminant,
    observer,
    astmTableNumber,
    astmTablesType: Array.isArray(astmTables) ? 'array' : typeof astmTables,
    astmTablesLen: Array.isArray(astmTables) ? astmTables.length : 'n/a'
  });

  const { refHex, sampleHex, deltaE } = computeColorsAndDeltaE(
    referenceSpectral,
    sampleSpectral,
    illuminant,
    observer,
    astmTableNumber,
    astmTables,
    matchData.default_delta_e
  );

  // Use matchData.matched_hex as fallback for reference color if computation failed
  const displayRefHex = refHex !== '#CCCCCC' ? refHex : (matchData.matched_hex || refHex);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="bg-primary p-6 text-center">
            <h1 className="text-2xl font-bold text-primary-foreground">Match Approval</h1>
          </div>
          
          <div className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">{colorName}</h2>
            
            <div className="flex gap-4 justify-center mb-6">
              <div className="text-center">
                <div 
                  className="w-32 h-32 rounded-lg border-2 shadow-lg"
                  style={{ backgroundColor: displayRefHex }}
                />
                <p className="text-sm text-muted-foreground mt-2 font-medium">Reference</p>
              </div>
              <div className="text-center">
                <div 
                  className="w-32 h-32 rounded-lg border-2 shadow-lg"
                  style={{ backgroundColor: sampleHex }}
                />
                <p className="text-sm text-muted-foreground mt-2 font-medium">Sample</p>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Job ID:</span>
                <span className="text-muted-foreground">{jobId}</span>
              </div>
              {qualitySetName && qualitySetName !== 'N/A' && (
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Quality Set:</span>
                  <span className="text-muted-foreground">{qualitySetName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Delta E:</span>
                <span className="text-muted-foreground">{deltaE}</span>
              </div>
              {location && location !== 'N/A' && (
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Location:</span>
                  <span className="text-muted-foreground">{location}</span>
                </div>
              )}
            </div>

            {searchParams.get('debug') === '1' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
                <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto">{JSON.stringify({
                  tokenValid,
                  qualitySetName: matchData.quality_set_name,
                  qualitySetMode: matchData.quality_set_mode,
                  selectedMode: modeKey,
                  astmTablesType: Array.isArray(astmTables) ? 'array' : typeof astmTables,
                  astmTablesLen: Array.isArray(astmTables) ? astmTables.length : 'n/a',
                  illuminant,
                  observer,
                  astmTableNumber,
                  usingDisplayRefHex: displayRefHex,
                  refHexComputed: refHex,
                  sampleHex,
                  deltaE,
                  hasReferenceSpectral: !!referenceSpectral,
                  hasSampleSpectral: !!sampleSpectral,
                  colorSpectralDataKeys: colorSpectralData ? Object.keys(colorSpectralData) : []
                }, null, 2)}</pre>
              </details>
            )}

            <div className="flex gap-4">
              <Button
                onClick={handleReject}
                disabled={processing}
                variant="outline"
                className="flex-1 h-14 text-lg"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reject'}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Approve'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileMatchApproval;
