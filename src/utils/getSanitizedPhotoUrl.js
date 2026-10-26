// getsanitiezedPhotoUrl.ts

const decodeHtmlEntities = (text: string): string => {
  if (!text || typeof text !== 'string') return text;
  // For now we only care about &amp; but this allows easy extension
  return text.replace(/&amp;/g, '&');
};

export const getSanitizedPhotoUrl = (text?: string | null): string | null => {
  if (!text || typeof text !== 'string') return text;
  // For now we only care about &amp; but this allows easy extension
  return text.replace(/&amp;/g, '&');


};