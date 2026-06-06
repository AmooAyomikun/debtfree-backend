const timestamp = () => new Date().toISOString();

export const log = {
  info: (message, data = {}) => {
    console.log(`[${timestamp()}] [INFO] ${message}`, 
      Object.keys(data).length ? data : '');
  },
  error: (message, error = {}) => {
    console.error(`[${timestamp()}] [ERROR] ${message}`, error);
  },
  payment: (reference, event, data = {}) => {
    console.log(`[${timestamp()}] [PAYMENT] [${event}] ref:${reference}`, data);
  },
  warn: (message, data = {}) => {
    console.warn(`[${timestamp()}] [WARN] ${message}`, data);
  }
};
