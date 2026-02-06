import { apiFetch } from './api';
import { PdfAttachment } from '../types';

const MAX_UPLOAD_BYTES = Number((import.meta as any).env?.VITE_MAX_UPLOAD_BYTES || 15 * 1024 * 1024);

export async function uploadPdfToR2(file: File): Promise<PdfAttachment> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File size exceeds upload limit.');
  }

  const presignRes = await apiFetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/pdf',
      size: file.size,
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err?.error || 'Failed to prepare upload');
  }

  const { key, uploadUrl, publicUrl } = await presignRes.json();

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error('Upload failed. Please try again.');
  }

  return {
    key,
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/pdf',
    url: publicUrl || undefined,
  };
}

export async function getPdfSignedUrl(key: string): Promise<string> {
  const res = await apiFetch('/api/uploads/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'Failed to load file');
  }
  const data = await res.json();
  return data.url;
}

export async function uploadPdfDataUrlToR2(dataUrl: string, filename: string): Promise<PdfAttachment> {
  const parts = dataUrl.split(',');
  if (parts.length < 2) throw new Error('Invalid PDF data');
  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || 'application/pdf';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const file = new File([bytes], filename || 'document.pdf', { type: mime });
  return uploadPdfToR2(file);
}
