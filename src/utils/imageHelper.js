/**
 * Converts a SharePoint sharing link to a direct download URL
 * suitable for rendering in React Native's Image component.
 */
export const convertSharePointUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('.sharepoint.com') && !url.includes('download=1')) {
    const base = url.split('?')[0];
    return `${base}?download=1`;
  }
  return url;
};
