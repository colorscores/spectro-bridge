import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, Loader2, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PasswordStrength from '@/components/ui/password-strength';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, resetPasswordForEmail } = useAuth();
  console.log('🔑 Login render', { hasUser: !!user });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  
  // Enhanced signup form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [signupStep, setSignupStep] = useState(1); // 1 = User Info, 2 = Company Info
  const [confirmationLink, setConfirmationLink] = useState(null);
  

  useEffect(() => {
    console.log('🔑 Login user state', { hasUser: !!user });
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    console.log('🔑 Login attempt starting for:', email);
    const { error: signInError } = await signIn(email, password);
    
    if (signInError) {
      console.error('🔑 Login failed:', signInError.message);
      setError(signInError.message);
    } else {
      console.log('🔑 Login successful, navigating to dashboard');
      // Add a small delay to ensure auth state is updated
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (isRegistering) {
        // Enhanced registration flow
        await proceedWithRegistration({
          firstName,
          lastName,
          organizationName,
          organizationType,
          email,
          password
        });
      } else {
        // Basic signup flow
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setSuccessMessage("Account created! Please check your email to verify your account. If you don't receive an email, try checking your spam folder or use the confirmation link if provided.");
          setIsSigningUp(false);
        }
      }
    } catch (error) {
      setError(error.message || 'An unexpected error occurred');
    }
    
    setIsLoading(false);
  };

  const proceedWithRegistration = async (registrationData) => {
    const response = await supabase.functions.invoke('register-organization', {
      body: registrationData
    });

    if (response.error) {
      const serverMsg = response?.error?.context?.error || response?.error?.context?.body || response?.data?.error || response.error.message || 'Registration failed';
      console.error('🧩 Registration error details:', response);
      throw new Error(serverMsg);
    }

    setSuccessMessage(response.data?.message || "Organization created successfully! Please check your email to verify your account and complete setup.");
    
    // If email wasn't sent, store the confirmation link for fallback UI
    if (response.data?.confirmationLink) {
      setConfirmationLink(response.data.confirmationLink);
    }
    
    setIsSigningUp(false);
    setIsRegistering(false);
    // Reset form
    setFirstName('');
    setLastName('');
    setOrganizationName('');
    setOrganizationType('');
    setEmail('');
    setPassword('');
  };

  
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
    setIsLoading(true);
    
    try {
      // Use only the custom edge function
      const { data, error } = await supabase.functions.invoke('reset-password-email', {
        body: { email: forgotPasswordEmail }
      });
      
      if (debugMode || import.meta.env.DEV) {
        console.log('🔍 Edge function response:', { data, error });
        console.log('🔍 Full error object:', error);
      }
      
      if (error) {
        // Log detailed error information in development
        if (import.meta.env.DEV) {
          console.error('🚨 Reset password error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            status: error.status
          });
        }
        
        setForgotPasswordError(`Password reset failed: ${error.message}`);
      } else {
        setForgotPasswordSuccess('Password reset email sent via Kontrol mailer. Check your inbox.');
        setTimeout(() => {
          setIsForgotPasswordOpen(false);
          setForgotPasswordEmail('');
          setForgotPasswordSuccess('');
        }, 3000);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('🚨 Unexpected error in handleForgotPassword:', error);
      }
      
      setForgotPasswordError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const toggleForm = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!isSigningUp) {
      // Going to signup - directly start registration flow
      setIsSigningUp(true);
      setIsRegistering(true);
      setSignupStep(1);
    } else {
      // Going back to login
      setIsSigningUp(false);
      setIsRegistering(false);
    }
    // Reset form fields
    setFirstName('');
    setLastName('');
    setOrganizationName('');
    setOrganizationType('');
    setEmail('');
    setPassword('');
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    setSignupStep(2);
  };

  const handlePrevStep = (e) => {
    e.preventDefault();
    setSignupStep(1);
  };

  const handleCancelRegistration = (e) => {
    e.preventDefault();
    setIsRegistering(false);
    setSignupStep(1);
    setFirstName('');
    setLastName('');
    setOrganizationName('');
    setOrganizationType('');
  };

  // Validation for enhanced signup
  const isFormValid = () => {
    if (!isRegistering) return email && password;
    
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordValid = password.length >= 8 && 
                         /[A-Z]/.test(password) && 
                         /[a-z]/.test(password) && 
                         /\d/.test(password) && 
                         /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Step 1 validation (User Info)
    if (signupStep === 1) {
      return firstName.trim() && lastName.trim() && emailValid && passwordValid;
    }
    
    // Step 2 validation (Company Info)
    return organizationName.trim() && organizationType.trim();
  };

  const formVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
  };

  return (
    <>
      <Helmet>
        <title>{isSigningUp ? 'Sign Up' : 'Login'} - Kontrol</title>
        <meta name="description" content={`${isSigningUp ? 'Create an account' : 'Login to your account'}.`} />
      </Helmet>
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 p-4 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-repeat bg-center pointer-events-none z-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '100px 100px',
          }}
        ></div>
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0) 0%, rgba(243,244,246,1) 70%)',
          }}
        ></div>
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-2xl"
        >
          <div className="text-center mb-8">
            
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-500">
              {isSigningUp ? (isRegistering ? (signupStep === 1 ? 'User Info' : 'Company Info') : 'Create an Account') : 'Welcome to'}
            </h1>
            {!isSigningUp && (
              <img
                src="/lovable-uploads/16e6f6bc-be20-4dfb-abdd-a928ec879777.png"
                alt="Kontrol logo"
                className="h-13 sm:h-16 mb-2 mx-auto"
                loading="eager"
              />
            )}
            <p className="text-sm text-gray-500">
              {isSigningUp ? 
                (isRegistering ? (signupStep === 1 ? 'Enter your personal details to get started.' : 'Fill in your organization details to complete setup.') : 'Enter your details to get started.') : 
                'Nice to see you again. Please enter your login data'
              }
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={isSigningUp ? 'signup' : 'login'}
              variants={formVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <form className="space-y-6" onSubmit={isSigningUp ? handleSignUp : handleLogin}>
                {/* Enhanced signup form fields */}
                {isSigningUp && isRegistering && signupStep === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                          First Name *
                        </Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          type="text"
                          required
                          placeholder="John"
                          className="w-full"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                          Last Name *
                        </Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          type="text"
                          required
                          placeholder="Doe"
                          className="w-full"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </>
                )}

                {isSigningUp && isRegistering && signupStep === 2 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="organizationName" className="text-sm font-medium text-gray-700">
                        Organization Name *
                      </Label>
                      <Input
                        id="organizationName"
                        name="organizationName"
                        type="text"
                        required
                        placeholder="Your Company Name"
                        className="w-full"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">
                        Organization Type *
                      </Label>
                      <RadioGroup 
                        value={organizationType} 
                        onValueChange={setOrganizationType}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Brand Owner" id="brand-owner" />
                          <Label htmlFor="brand-owner" className="text-sm font-normal">Brand Owner</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Print Supplier" id="print-supplier" />
                          <Label htmlFor="print-supplier" className="text-sm font-normal">Print Supplier</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Premedia Agency" id="premedia-agency" />
                          <Label htmlFor="premedia-agency" className="text-sm font-normal">Premedia Agency</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Design Agency" id="design-agency" />
                          <Label htmlFor="design-agency" className="text-sm font-normal">Design Agency</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Vendor" id="vendor" />
                          <Label htmlFor="vendor" className="text-sm font-normal">Vendor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Ink Supplier" id="ink-supplier" />
                          <Label htmlFor="ink-supplier" className="text-sm font-normal">Ink Supplier</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </>
                )}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md flex items-center"
                    role="alert"
                  >
                    <AlertCircle className="h-5 w-5 mr-3" />
                    <p className="text-sm font-medium">{error}</p>
                  </motion.div>
                )}
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md"
                    role="alert"
                  >
                    <div className="flex items-start">
                      <Mail className="h-5 w-5 mr-3 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{successMessage}</p>
                        {confirmationLink && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-green-600">
                              Email not delivered? Use the confirmation link below:
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => window.open(confirmationLink, '_blank')}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Confirm Account
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(confirmationLink)}
                                className="text-green-700 border-green-300 hover:bg-green-50"
                              >
                                Copy Link
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
                {/* Email and Password fields - show on login and step 1 of signup */}
                {(!isSigningUp || (isSigningUp && isRegistering && signupStep === 1)) && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        Email {isSigningUp && isRegistering && '*'}
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder={isSigningUp && isRegistering ? "john@company.com" : "Please enter your email address."}
                        className="w-full placeholder:text-muted-foreground/40"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password {isSigningUp && isRegistering && '*'}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={passwordVisible ? 'text' : 'password'}
                          autoComplete={isSigningUp ? 'new-password' : 'current-password'}
                          required
                          className="w-full"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isLoading}
                          placeholder={isSigningUp && isRegistering ? "Create a strong password" : ""}
                        />
                        <button
                          type="button"
                          onClick={() => setPasswordVisible(!passwordVisible)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                          disabled={isLoading}
                        >
                          {passwordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {isSigningUp && isRegistering && (
                        <PasswordStrength password={password} />
                      )}
                    </div>
                  </>
                )}

                {!isSigningUp && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Checkbox id="remember-me" name="remember-me" disabled={isLoading} />
                      <Label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                        Remember me
                      </Label>
                    </div>

                    <div className="text-sm">
                      <button type="button" onClick={() => setIsForgotPasswordOpen(true)} className="font-medium text-blue-600 hover:text-blue-500">
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {isSigningUp && isRegistering ? (
                    signupStep === 1 ? (
                      <div className="flex space-x-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-1/2" 
                          disabled={isLoading}
                          onClick={handleCancelRegistration}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="button" 
                          className="w-1/2 bg-blue-600 hover:bg-blue-700" 
                          disabled={isLoading || !isFormValid()}
                          onClick={handleNextStep}
                        >
                          Next
                        </Button>
                      </div>
                    ) : (
                      <div className="flex space-x-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-1/2" 
                          disabled={isLoading}
                          onClick={handlePrevStep}
                        >
                          Back
                        </Button>
                        <Button 
                          type="submit" 
                          className="w-1/2 bg-blue-600 hover:bg-blue-700" 
                          disabled={isLoading || !isFormValid()}
                        >
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Let's Go!
                        </Button>
                      </div>
                    )
                  ) : (
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700" 
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isSigningUp ? 'Sign up for free!' : 'Get in Kontrol'}
                    </Button>
                  )}
                </div>
              </form>
            </motion.div>
          </AnimatePresence>

          {/* Not in Kontrol message */}
          {!isSigningUp && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Not in Kontrol?{' '}
                <button
                  onClick={toggleForm}
                  className="font-medium text-blue-600 hover:text-blue-500 underline"
                >
                  Sign up for free!
                </button>
              </p>
            </div>
          )}

          {/* Back to login link */}
          {isSigningUp && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={toggleForm}
                  className="font-medium text-blue-600 hover:text-blue-500 underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}

          {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1' && (
            <div className="mt-2 text-xs text-gray-500 text-center">
              Debug mode: Open browser console to see Supabase project URL/ref.
            </div>
          )}

        </motion.div>
      </div>


      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword}>
            <div className="grid gap-4 py-4">
              {forgotPasswordError && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md flex items-center text-sm">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {forgotPasswordError}
                </div>
              )}
              {forgotPasswordSuccess && (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 rounded-md flex items-center text-sm">
                  <Mail className="h-4 w-4 mr-2" />
                  {forgotPasswordSuccess}
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="forgot-email" className="text-right">
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="col-span-3"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsForgotPasswordOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send Reset Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
export default Login;