import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,PUT',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'PUT') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.replace('Bearer ', '').trim();

    if (!accessToken) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/+/, '').split('/');

    if (parts.length !== 4 || parts[0] !== 'api' || parts[1] !== 'items' || parts[3] !== 'image') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const itemId = parts[2];

    const payload = (await request.json().catch(() => null)) as
      | {
          imageUrl?: unknown;
          metadata?: { contentType?: unknown; size?: unknown };
        }
      | null;

    if (!payload || typeof payload.imageUrl !== 'string') {
      return new Response('Missing imageUrl', { status: 400, headers: corsHeaders });
    }

    const metadata = payload.metadata ?? {};
    const contentType =
      typeof metadata.contentType === 'string' ? metadata.contentType : undefined;
    const size =
      typeof metadata.size === 'number' ? Number(metadata.size) : Number.NaN;

    if (!contentType || !contentType.startsWith('image/')) {
      return new Response('Invalid content type', { status: 400, headers: corsHeaders });
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
      return new Response('File too large', { status: 413, headers: corsHeaders });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData?.user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const imageUrl = payload.imageUrl;

    const { error: updateError } = await supabase
      .from('items')
      .update({ image_url: imageUrl })
      .eq('id', itemId)
      .eq('owner_id', authData.user.id)
      .select('id')
      .single();

    if (updateError) {
      console.error(updateError);
      return new Response('Could not update item', { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ imageUrl }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  },
};
