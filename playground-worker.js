// Web Worker para executar código JavaScript com isolamento de segurança
self.onmessage = function(event) {
  const { code } = event.data;
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  // Redirect console methods
  console.log = (...args) => {
    logs.push({
      type: 'log',
      content: args.map(arg => {
        if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
        return String(arg);
      }).join(' ')
    });
  };

  console.error = (...args) => {
    logs.push({
      type: 'error',
      content: '❌ ' + args.map(arg => String(arg)).join(' ')
    });
  };

  console.warn = (...args) => {
    logs.push({
      type: 'warn',
      content: '⚠️ ' + args.map(arg => String(arg)).join(' ')
    });
  };

  try {
    // Execute the code using Function to avoid eval warnings
    const fn = new Function(code);
    const result = fn();

    if (result !== undefined) {
      logs.push({
        type: 'result',
        content: '↪️ ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result))
      });
    }

    self.postMessage({
      success: true,
      message: logs.length > 0 ? logs : [{ type: 'success', content: '✓ Executado com sucesso' }],
      error: null
    });
  } catch (e) {
    self.postMessage({
      success: false,
      message: logs,
      error: {
        message: e.message,
        stack: e.stack
      }
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
};
