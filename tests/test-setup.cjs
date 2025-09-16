const Module = require('module');
const path = require('node:path');

const originalLoad = Module._load;
const SUPABASE_MODULES = new Set([
  '@supabase/supabase-js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
]);

Module._load = function patchedLoad(request, parent, isMain) {
  if (SUPABASE_MODULES.has(request)) {
    return require(path.join(__dirname, 'stubs', 'supabase-js.js'));
  }

  return originalLoad(request, parent, isMain);
};
