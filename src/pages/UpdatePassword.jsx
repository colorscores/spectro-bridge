import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading: authLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [tokenVerified, setTokenVerified] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // Custom reset token flow
      setResetToken(token);
      verifyResetToken(token);
    } else {
      // Original Supabase flow
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
      });

      if (!authLoading && !isPasswordRecovery) {
        // Small delay to allow onAuthStateChange to fire
        setTimeout(() => {
          if(!isPasswordRecovery) navigate('/login');
        }, 500);
      }

      return () => subscription.unsubscribe();
    }
  }, [authLoading, navigate, isPasswordRecovery, searchParams]);

  const verifyResetToken = async (token) => {
    setVerifyingToken(true);
    setError('');
    
    try {
      const { data, error } = await supabase.rpc('verify_reset_token', {
        p_token: token
      });
      
      if (error) {
        setError('Invalid or expired reset link. Please request a new one.');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setTokenVerified(true);
      }
    } catch (err) {
      setError('Invalid or expired reset link. Please request a new one.');
      setTimeout(() => navigate('/login'), 3000);
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }
    setIsLoading(true);
    setError('');
    
    try {
      if (resetToken && tokenVerified) {
        // Custom reset token flow - use edge function to update password
        const { data, error: updateError } = await supabase.functions.invoke('update-password-with-token', {
          body: { 
            token: resetToken,
            newPassword: password
          }
        });
        
        if (updateError) {
          setError(updateError.message || 'Failed to update password');
        } else {
          navigate('/login');
        }
      } else {
        // Original Supabase flow
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          setError(updateError.message);
        } else {
          navigate('/login');
        }
      }
    } catch (error) {
      setError('Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading && !isPasswordRecovery && !resetToken) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (verifyingToken) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Update Password - Kontrol</title>
        <meta name="description" content="Update your account password." />
      </Helmet>
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 p-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-2xl"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Create a New Password
            </h1>
            <p className="text-sm text-gray-500">
              Please enter and confirm your new password below.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleUpdatePassword}>
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
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  required
                  placeholder="**********"
                  className="w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                placeholder="**********"
                className="w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default UpdatePassword;