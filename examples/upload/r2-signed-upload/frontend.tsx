import { useState, type ChangeEvent } from 'react';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL!,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

interface Props {
  itemId: string;
}

interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

export function ItemImageUploaderR2({ itemId }: Props) {
  const [status, setStatus] = useState('');

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setStatus('Bitte nur Bilddateien auswählen.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus('Das Bild darf maximal 2 MB groß sein.');
      event.target.value = '';
      return;
    }

    setStatus('Signierte URL wird angefordert …');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setStatus('Bitte logge dich zuerst ein.');
      return;
    }

    const uploadUrlResponse = await fetch('/api/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        itemId,
        contentType: file.type,
        size: file.size,
      }),
    });

    if (!uploadUrlResponse.ok) {
      const payload = await uploadUrlResponse.json().catch(() => ({}));
      console.error(payload);
      setStatus('Konnte keine Upload-URL erzeugen.');
      return;
    }

    const { uploadUrl, publicUrl } = (await uploadUrlResponse.json()) as UploadUrlResponse;

    setStatus('Upload läuft …');

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!putResponse.ok) {
      console.error(await putResponse.text());
      setStatus('Upload nach R2 fehlgeschlagen.');
      return;
    }

    const { error: updateError } = await supabase
      .from('items')
      .update({ image_url: publicUrl })
      .eq('id', itemId)
      .eq('owner_id', session.user.id)
      .select('id')
      .single();

    if (updateError) {
      console.error(updateError);
      setStatus('Das Bild konnte nicht gespeichert werden.');
      return;
    }

    setStatus('Bild erfolgreich hochgeladen.');
    event.target.value = '';
  };

  return (
    <form className="upload-form">
      <label className="upload-label">
        Item-Bild hochladen
        <input
          accept="image/png,image/jpeg"
          type="file"
          onChange={handleFileChange}
        />
      </label>
      {status && <p className="upload-status">{status}</p>}
    </form>
  );
}
