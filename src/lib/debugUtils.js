// Debug utility for conditional logging - only logs in development
const isDevelopment = import.meta.env.DEV;

export const debug = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // Always log errors, but with context
    console.error('[Error]', ...args);
  },
  info: (...args) => {
    if (isDevelopment) {
      console.info('[Info]', ...args);
    }
  },
  time: (label) => {
    if (isDevelopment) {
      console.time(label);
    }
  },
  timeEnd: (label) => {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  }
};