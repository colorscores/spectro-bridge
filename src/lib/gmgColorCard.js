import { supabase } from './customSupabaseClient';

const TOKEN_KEY = 'gmg_access_token';
const REFRESH_TOKEN_KEY = 'gmg_refresh_token';
const ID_TOKEN_KEY = 'gmg_id_token';
const EXPIRY_KEY = 'gmg_token_expiry';
const AWS_ACCESS_KEY_ID = 'gmg_aws_access_key_id';
const AWS_SECRET_ACCESS_KEY = 'gmg_aws_secret_access_key';
const AWS_SESSION_TOKEN = 'gmg_aws_session_token';
const AWS_CREDENTIALS_EXPIRY = 'gmg_aws_credentials_expiry';
const IDENTITY_ID_KEY = 'gmg_identity_id';

export const getStoredToken = () => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = sessionStorage.getItem(EXPIRY_KEY);
  
  if (!token || !expiry) return null;
  if (Date.now() >= parseInt(expiry)) {
    return null; // Don't clear, allow refresh
  }
  
  return token;
};

export const getStoredRefreshToken = () => {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
};

export const storeTokens = (accessToken, refreshToken, idToken, expiresIn, awsCredentials = null, identityId = null) => {
  const expiry = Date.now() + (expiresIn * 1000);
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (idToken) sessionStorage.setItem(ID_TOKEN_KEY, idToken);
  sessionStorage.setItem(EXPIRY_KEY, expiry.toString());
  
  // Store AWS credentials if provided
  if (awsCredentials) {
    sessionStorage.setItem(AWS_ACCESS_KEY_ID, awsCredentials.accessKeyId);
    sessionStorage.setItem(AWS_SECRET_ACCESS_KEY, awsCredentials.secretAccessKey);
    sessionStorage.setItem(AWS_SESSION_TOKEN, awsCredentials.sessionToken);
    const awsExpiry = new Date(awsCredentials.expiration).getTime();
    sessionStorage.setItem(AWS_CREDENTIALS_EXPIRY, awsExpiry.toString());
  }
  
  if (identityId) {
    sessionStorage.setItem(IDENTITY_ID_KEY, identityId);
  }
};

// Backward compatibility
export const storeToken = (token, expiresIn) => {
  storeTokens(token, null, null, expiresIn);
};

export const clearStoredToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ID_TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  sessionStorage.removeItem(AWS_ACCESS_KEY_ID);
  sessionStorage.removeItem(AWS_SECRET_ACCESS_KEY);
  sessionStorage.removeItem(AWS_SESSION_TOKEN);
  sessionStorage.removeItem(AWS_CREDENTIALS_EXPIRY);
  sessionStorage.removeItem(IDENTITY_ID_KEY);
};

// Check AWS credentials validity
export const hasValidAWSCredentials = () => {
  const awsExpiry = sessionStorage.getItem(AWS_CREDENTIALS_EXPIRY);
  if (!awsExpiry) return false;
  return Date.now() < parseInt(awsExpiry);
};

// Get AWS credentials
export const getAWSCredentials = () => {
  if (!hasValidAWSCredentials()) return null;
  
  return {
    accessKeyId: sessionStorage.getItem(AWS_ACCESS_KEY_ID),
    secretAccessKey: sessionStorage.getItem(AWS_SECRET_ACCESS_KEY),
    sessionToken: sessionStorage.getItem(AWS_SESSION_TOKEN),
    identityId: sessionStorage.getItem(IDENTITY_ID_KEY)
  };
};

// Refresh token if expired
export const refreshTokenIfNeeded = async () => {
  const currentToken = getStoredToken();
  if (currentToken) return currentToken;
  
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;
  
  try {
    const { data, error } = await supabase.functions.invoke('gmg-colorcard', {
      body: { action: 'refresh-token', refreshToken },
    });
    
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    if (data?.success && data?.accessToken) {
      storeTokens(data.accessToken, refreshToken, data.idToken, data.expiresIn, data.awsCredentials, data.identityId);
      return data.accessToken;
    }
    
    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearStoredToken();
    return null;
  }
};

export const authenticateGMG = async (username, password) => {
  const { data, error } = await supabase.functions.invoke('gmg-colorcard', {
    body: { action: 'authenticate', username, password },
  });
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  
  if (data?.accessToken && data?.expiresIn) {
    storeTokens(data.accessToken, data.refreshToken, data.idToken, data.expiresIn, data.awsCredentials, data.identityId);
  }
  
  return data;
};

export const fetchGMGOptions = async (accessToken) => {
  const validToken = await refreshTokenIfNeeded() || accessToken;
  const { data: { session } } = await supabase.auth.getSession();
  
  const invokeOptions = {
    body: { action: 'get-options', accessToken: validToken }
  };
  
  if (session?.access_token) {
    invokeOptions.headers = { Authorization: `Bearer ${session.access_token}` };
  }
  
  const { data, error } = await supabase.functions.invoke('gmg-colorcard', invokeOptions);
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  
  return data;
};

export const fetchCardBalance = async (accessToken) => {
  const validToken = await refreshTokenIfNeeded() || accessToken;
  const { data: { session } } = await supabase.auth.getSession();
  
  const invokeOptions = {
    body: { action: 'get-balance', accessToken: validToken }
  };
  
  if (session?.access_token) {
    invokeOptions.headers = { Authorization: `Bearer ${session.access_token}` };
  }
  
  const { data, error } = await supabase.functions.invoke('gmg-colorcard', invokeOptions);
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  
  return data;
};

export const submitPrintOrder = async (accessToken, orderData) => {
  const validToken = await refreshTokenIfNeeded() || accessToken;
  const { data: { session } } = await supabase.auth.getSession();
  
  const invokeOptions = {
    body: { action: 'submit-order', accessToken: validToken, ...orderData }
  };
  
  if (session?.access_token) {
    invokeOptions.headers = { Authorization: `Bearer ${session.access_token}` };
  }
  
  const { data, error } = await supabase.functions.invoke('gmg-colorcard', invokeOptions);
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  
  return data;
};

// Session storage for last-used configuration
export const saveLastConfig = (substrate, template, flow) => {
  if (substrate) sessionStorage.setItem('gmg_last_substrate', JSON.stringify(substrate));
  if (template) sessionStorage.setItem('gmg_last_template', JSON.stringify(template));
  if (flow) sessionStorage.setItem('gmg_last_flow', JSON.stringify(flow));
};

export const getLastConfig = () => {
  try {
    return {
      substrate: JSON.parse(sessionStorage.getItem('gmg_last_substrate') || 'null'),
      template: JSON.parse(sessionStorage.getItem('gmg_last_template') || 'null'),
      flow: JSON.parse(sessionStorage.getItem('gmg_last_flow') || 'null'),
    };
  } catch {
    return { substrate: null, template: null, flow: null };
  }
};
