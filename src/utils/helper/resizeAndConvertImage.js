// utils/resizeAndConvertImage.js
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';

/**
 * Resizes and converts an image to Base64
 * @param {string} uri - The image URI to process
 * @param {number} width - Target width (default 800)
 * @param {number} height - Target height (default 800)
 * @param {number} quality - JPEG quality percentage (default 70)
 * @returns {Promise<{ base64: string, uri: string, sizeKB: number }>} 
 */
export const resizeAndConvertImage = async (
  uri,
  width = 800,
  height = 800,
  quality = 60
) => {
  try {
    // Resize image
    const compressedImage = await ImageResizer.createResizedImage(
      uri,
      width,
      height,
      'JPEG',
      quality,
      0,
      undefined,
      false,
      { mode: 'contain', onlyScaleDown: true }
    );

    // Convert to Base64
    const base64 = await RNFS.readFile(compressedImage.uri, 'base64');
    const sizeKB = (base64.length * (3 / 4)) / 1024;

    return {
      base64,
      uri: compressedImage.uri,
      sizeKB: sizeKB.toFixed(2),
    };
  } catch (error) {
    console.error(' resizeAndConvertImage Error:', error);
    throw error;
  }
};
