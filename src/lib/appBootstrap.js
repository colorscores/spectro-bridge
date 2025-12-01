// Application bootstrap monitoring and logging
console.log('🚀 App Bootstrap: Starting initialization monitoring');

const BOOTSTRAP_TIMEOUT = 20000; // 20 seconds
let bootstrapTimer;

const logBootstrapStep = (step, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`🚀 Bootstrap [${timestamp}]: ${step}`, data);
};

const startBootstrapMonitoring = () => {
  logBootstrapStep('Starting application bootstrap');
  
  bootstrapTimer = setTimeout(() => {
    console.error('🚨 Bootstrap TIMEOUT: Application failed to initialize within 20 seconds');
    console.log('📊 Current state:', {
      reactMounted: !!document.querySelector('#root > *'),
      hasAuthContext: !!window.authContext,
      hasQueryClient: !!window.queryClient,
      currentUrl: window.location.href,
      readyState: document.readyState
    });
  }, BOOTSTRAP_TIMEOUT);
};

const completeBootstrap = () => {
  if (bootstrapTimer) {
    clearTimeout(bootstrapTimer);
    logBootstrapStep('Bootstrap completed successfully');
  }
};

// Monitor React component mounting safely without assuming global React
let originalMount = null;
try {
  if (typeof React !== 'undefined' && React.createElement) {
    originalMount = React.createElement;
  }
} catch (e) {
  // no-op: React may not be globally available in ESM/Vite
}

if (originalMount) {
  let componentCount = 0;
  const originalCreateElement = originalMount;
  React.createElement = function(...args) {
    componentCount++;
    if (componentCount === 1) {
      logBootstrapStep('First React component created');
    } else if (componentCount === 10) {
      logBootstrapStep('React component tree building', { count: componentCount });
    }
    return originalCreateElement.apply(this, args);
  };
}

// Start monitoring immediately
startBootstrapMonitoring();

// Auto-complete if page fully loads
window.addEventListener('load', () => {
  logBootstrapStep('Window load event fired');
  setTimeout(completeBootstrap, 2000); // Give React 2 seconds to mount
});

export { logBootstrapStep, completeBootstrap };