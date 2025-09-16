const Module = require('module');
const path = require('node:path');

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@supabase/supabase-js') {
    return require(path.join(__dirname, 'stubs', 'supabase-js.js'));
  }

  return originalLoad(request, parent, isMain);
};
