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

export function ItemImageUploader({ itemId }: Props) {
  const [status, setStatus] = useState<string>('');

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

    setStatus('Starte Upload …');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setStatus('Bitte logge dich zuerst ein.');
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const storagePath = `${session.user.id}/${itemId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      setStatus('Upload fehlgeschlagen.');
      return;
    }

    const { data: publicData } = supabase.storage.from('item-images').getPublicUrl(storagePath);
    const publicUrl = publicData.publicUrl;

    const response = await fetch(`/api/items/${itemId}/image`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        imageUrl: publicUrl,
        metadata: {
          contentType: file.type,
          size: file.size,
        },
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.error(payload);
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
