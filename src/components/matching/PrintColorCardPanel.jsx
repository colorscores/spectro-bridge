import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  authenticateGMG,
  fetchGMGOptions,
  fetchCardBalance,
  submitPrintOrder,
  getStoredToken,
  clearStoredToken,
  saveLastConfig,
  getLastConfig,
} from '@/lib/gmgColorCard';

export default function PrintColorCardPanel({ isOpen, onClose, colorData }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [substrates, setSubstrates] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [flows, setFlows] = useState([]);
  
  const [selectedSubstrate, setSelectedSubstrate] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [selectedCardType, setSelectedCardType] = useState('Standard');
  
  const [cardBalance, setCardBalance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for stored token on panel open
  useEffect(() => {
    if (isOpen) {
      const storedToken = getStoredToken();
      if (storedToken) {
        setAccessToken(storedToken);
        setIsAuthenticated(true);
        loadOptions(storedToken);
      }
      
      // Debug logging to trace data flow
      console.debug('[PrintColorCardPanel] Panel opened with colorData:', {
        name: colorData?.name,
        hasSpectralData: !!colorData?.spectral_data,
        illuminant: colorData?.illuminant,
        observer: colorData?.observer
      });
    }
  }, [isOpen]);

  // Load GMG options (substrates, templates, flows)
  const loadOptions = async (token) => {
    setIsLoading(true);
    try {
      // Load options first
      const optionsData = await fetchGMGOptions(token);

      setSubstrates(optionsData.substrates || []);
      setTemplates(optionsData.templates || []);
      setFlows(optionsData.flows || []);

      // Restore last-used configuration
      const lastConfig = getLastConfig();
      if (lastConfig.substrate && optionsData.substrates?.find(s => s.id === lastConfig.substrate.id)) {
        setSelectedSubstrate(lastConfig.substrate.id);
      }
      if (lastConfig.template && optionsData.templates?.find(t => t.id === lastConfig.template.id)) {
        setSelectedTemplate(lastConfig.template.id);
      }
      if (lastConfig.flow && optionsData.flows?.find(f => f.id === lastConfig.flow.id)) {
        setSelectedFlow(lastConfig.flow.id);
      }

      // Fetch balance but do not block UI if it fails
      try {
        const balanceData = await fetchCardBalance(token);
        setCardBalance(balanceData);
        
        // Show friendly warning once per session if balance is unavailable
        if (balanceData?.balanceUnavailable) {
          const alreadyWarned = sessionStorage.getItem('gmgBalanceWarned');
          if (!alreadyWarned) {
            toast({
              title: 'Balance Unavailable',
              description: 'GMG balance is temporarily unavailable. You can still print.',
              variant: 'default',
            });
            sessionStorage.setItem('gmgBalanceWarned', '1');
          }
        }
      } catch (err) {
        console.warn('GMG balance unavailable:', err);
        setCardBalance(null);
      }
    } catch (error) {
      console.error('Failed to load GMG options:', error);
      toast({
        title: 'Error',
        description: 'Failed to load GMG options. Please try again.',
        variant: 'destructive',
      });
      // Do not log the user out due to partial load failures
    } finally {
      setIsLoading(false);
    }
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await authenticateGMG(username, password);
      setAccessToken(result.accessToken);
      setIsAuthenticated(true);
      setPassword(''); // Clear password
      await loadOptions(result.accessToken);
      toast({
        title: 'Success',
        description: 'Successfully logged in to GMG ColorCard',
      });
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!colorData?.spectral_data) {
      toast({
        title: "Missing spectral data",
        description: "Cannot print without spectral data",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      console.debug('[PrintColorCardPanel] Submitting with direct color data:', colorData.name);

      const result = await submitPrintOrder(accessToken, {
        directColorData: colorData,
        substrateId: selectedSubstrate,
        templateId: selectedTemplate,
        flowId: selectedFlow,
        cardType: selectedCardType,
      });

      // Save configuration for next time
      const substrateObj = substrates.find(s => s.id === selectedSubstrate);
      const templateObj = templates.find(t => t.id === selectedTemplate);
      const flowObj = flows.find(f => f.id === selectedFlow);
      saveLastConfig(substrateObj, templateObj, flowObj);

      toast({
        title: "Print order submitted",
        description: `Order submitted successfully for ${colorData.name}`,
      });
      
      onClose();
    } catch (error) {
      console.error('Print submission error:', error);
      toast({
        title: "Print failed",
        description: error.message || "Failed to submit print order",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = isAuthenticated && 
                    selectedSubstrate && 
                    selectedTemplate && 
                    selectedFlow && 
                    colorData?.spectral_data &&
                    !isSubmitting;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        hideOverlay={true}
        className="w-[33.333vw] max-w-[500px] min-w-[400px] right-0 left-auto h-[calc(100vh-60px)] border-l"
      >
        <SheetHeader>
          <SheetTitle>Print Color Card</SheetTitle>
          <SheetDescription>
            Configure and submit print job to GMG ColorCard
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {!isAuthenticated ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your GMG username"
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your GMG password"
                  disabled={isLoading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Log in to GMG ColorCard'
                )}
              </Button>
            </form>
          ) : (
            <>
              {cardBalance && (
                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                  <span className="text-sm font-medium">Card Balance</span>
                  {cardBalance.balanceUnavailable ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Unavailable</Badge>
                      <span className="text-xs text-muted-foreground">(You can still print)</span>
                    </div>
                  ) : (
                    <Badge variant="secondary">
                      {cardBalance.cardsRemaining} of {cardBalance.cardsTotal} remaining
                    </Badge>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="substrate">Substrate</Label>
                    <Select value={selectedSubstrate} onValueChange={setSelectedSubstrate}>
                      <SelectTrigger id="substrate">
                        <SelectValue placeholder="Select substrate" />
                      </SelectTrigger>
                      <SelectContent>
                        {substrates.map((substrate) => (
                          <SelectItem key={substrate.id} value={substrate.id}>
                            {substrate.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template">Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger id="template">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="flow">Flow (Output Destination)</Label>
                    <Select value={selectedFlow} onValueChange={setSelectedFlow}>
                      <SelectTrigger id="flow">
                        <SelectValue placeholder="Select flow" />
                      </SelectTrigger>
                      <SelectContent>
                        {flows.map((flow) => (
                          <SelectItem key={flow.id} value={flow.id}>
                            {flow.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Card Type</Label>
                    <RadioGroup value={selectedCardType} onValueChange={setSelectedCardType}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Standard" id="standard" />
                        <Label htmlFor="standard" className="font-normal">Standard</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Density" id="density" />
                        <Label htmlFor="density" className="font-normal">Density</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="DeltaE" id="deltae" />
                        <Label htmlFor="deltae" className="font-normal">Delta E</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {isAuthenticated && (
            <Button onClick={handlePrint} disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Printing...
                </>
              ) : (
                'Print'
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
