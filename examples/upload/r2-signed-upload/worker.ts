import { createClient } from '@supabase/supabase-js';
import type { R2Bucket } from '@cloudflare/workers-types';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ITEM_IMAGES: R2Bucket;
  R2_PUBLIC_BASE_URL: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,POST',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SIGNED_UPLOAD_TTL_SECONDS = 5 * 60;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.replace('Bearer ', '').trim();

    if (!accessToken) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const payload = await request.json().catch(() => null);

    if (
      !payload ||
      typeof payload.contentType !== 'string' ||
      typeof payload.size !== 'number' ||
      typeof payload.itemId !== 'string'
    ) {
      return new Response('Invalid payload', { status: 400, headers: corsHeaders });
    }

    const { contentType, size, itemId } = payload as {
      contentType: string;
      size: number;
      itemId: string;
    };

    if (!contentType.startsWith('image/')) {
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

    const extension = contentType.split('/')[1]?.toLowerCase() ?? 'bin';
    const objectKey = `${authData.user.id}/${itemId}/${crypto.randomUUID()}.${extension}`;

    const signedUrl = await env.ITEM_IMAGES.createSignedUrl({
      key: objectKey,
      method: 'PUT',
      expiration: SIGNED_UPLOAD_TTL_SECONDS,
      headers: {
        'content-type': contentType,
        'content-length': size.toString(),
      },
    });

    const publicUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${objectKey}`;

    return new Response(
      JSON.stringify({
        uploadUrl: signedUrl.toString(),
        publicUrl,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  },
};
