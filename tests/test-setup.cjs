const Module = require('module');
const path = require('node:path');

const originalLoad = Module._load;
const SUPABASE_MODULE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === SUPABASE_MODULE || request === '@supabase/supabase-js') {
    return require(path.join(__dirname, 'stubs', 'supabase-js.js'));
  }

  return originalLoad(request, parent, isMain);
};
