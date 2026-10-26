// utils/imagePicker.ts
import { Platform, PermissionsAndroid } from "react-native";
import { launchCamera, launchImageLibrary, Asset } from "react-native-image-picker";
import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";

/**
 * Process an Asset from react-native-image-picker into the shape your app uses:
 * { uri, resizedUri, base64, fileName, type }
 */
export async function processAsset(asset: Asset, maxSize = 800) {
  if (!asset?.uri) return null;

  try {
    const originalUri = asset.uri;
    const resized = await ImageResizer.createResizedImage(
      originalUri,
      maxSize,
      maxSize,
      "JPEG",
      80,
      0
    );
    const resizedPath = resized.path || resized.uri;
    const pathForRead =
      Platform.OS === "ios" && resizedPath.startsWith("file://")
        ? resizedPath.replace("file://", "")
        : resizedPath;

    const base64Data = await RNFS.readFile(pathForRead, "base64");

    const imageObj = {
      uri: originalUri,
      resizedUri: resized.uri || resizedPath,
      base64: base64Data,
      fileName: asset.fileName || `img_${Date.now()}.jpg`,
      type: asset.type || "image/jpeg",
    };
    return imageObj;
  } catch (err) {
    console.warn("processAsset error:", err);
    return null;
  }
}

/** Request camera permission on Android (returns true if allowed) */
export async function requestCameraPermissionAndroid() {
  if (Platform.OS !== "android") return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: "Camera Permission",
        message: "App needs camera access to take photos.",
        buttonPositive: "OK",
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    return false;
  }
}

/**
 * Launch camera, process the picked asset and return processed image object (or null)
 */
export async function pickImageFromCamera(options = { saveToPhotos: true, maxSize: 800 }) {
  const allowed = await requestCameraPermissionAndroid();
  if (!allowed) return null;

  try {
    const result = await launchCamera({ mediaType: "photo", saveToPhotos: !!options.saveToPhotos, selectionLimit: 1 });
    if (!result || !result.assets || result.assets.length === 0) return null;
    return await processAsset(result.assets[0], options.maxSize);
  } catch (err) {
    console.warn("pickImageFromCamera error:", err);
    return null;
  }
}

/**
 * Launch image library and return processed image object (or null)
 */
export async function pickImageFromLibrary(options = { maxSize: 800 }) {
  try {
    const result = await launchImageLibrary({ mediaType: "photo", selectionLimit: 1 });
    if (!result || !result.assets || result.assets.length === 0) return null;
    return await processAsset(result.assets[0], options.maxSize);
  } catch (err) {
    console.warn("pickImageFromLibrary error:", err);
    return null;
  }
}
