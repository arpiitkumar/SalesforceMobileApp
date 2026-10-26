// utils/imagePicker.ts

import {
  Platform,
  PermissionsAndroid,
} from "react-native";

import {
  launchImageLibrary,
  Asset,
} from "react-native-image-picker";

import ImageResizer from "react-native-image-resizer";
import RNFS from "react-native-fs";
import {
  Camera,
} from "react-native-vision-camera";

type CaptureCameraOptions = {
  saveToPhotos?: boolean;
  maxSize?: number;
  cameraRef?: any;
};

/**
 * Process Asset into existing app format
 */
export async function processAsset(
  asset: any,
  maxSize = 800
) {
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
      Platform.OS === "ios" &&
      resizedPath.startsWith("file://")
        ? resizedPath.replace("file://", "")
        : resizedPath;

    const base64Data = await RNFS.readFile(
      pathForRead,
      "base64"
    );

    const imageObj = {
      uri: originalUri,
      resizedUri: resized.uri || resizedPath,
      base64: base64Data,
      fileName:
        asset.fileName ||
        `img_${Date.now()}.jpg`,
      type: asset.type || "image/jpeg",
    };

    return imageObj;
  } catch (err) {
    console.warn("processAsset error:", err);
    return null;
  }
}

/**
 * Camera Permission
 */
export async function requestCameraPermissionAndroid() {
  if (Platform.OS !== "android") return true;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: "Camera Permission",
        message:
          "App needs camera access to take photos.",
        buttonPositive: "OK",
      }
    );

    return (
      granted === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (e) {
    return false;
  }
}

/**
 * Vision Camera Capture
 * RETURN FORMAT SAME RAHEGA
 */
export async function pickImageFromCamera(
  options: CaptureCameraOptions = {
    saveToPhotos: true,
    maxSize: 800,
  }
) {
  try {
    const allowed =
      await requestCameraPermissionAndroid();

    if (!allowed) return null;

    if (!options.cameraRef?.current) {
      console.warn("Camera ref missing");
      return null;
    }

    const photo =
      await options.cameraRef.current.takePhoto({
        flash: "off",
        enableShutterSound: true,
      });

    if (!photo?.path) return null;

    const asset = {
      uri:
        Platform.OS === "android"
          ? `file://${photo.path}`
          : photo.path,
      fileName: `img_${Date.now()}.jpg`,
      type: "image/jpeg",
    };

    return await processAsset(
      asset,
      options.maxSize
    );
  } catch (err) {
    console.warn(
      "pickImageFromCamera error:",
      err
    );
    return null;
  }
}

/**
 * Gallery Picker
 * SAME AS BEFORE
 */
export async function pickImageFromLibrary(
  options = { maxSize: 800 }
) {
  try {
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
    });

    if (
      !result ||
      !result.assets ||
      result.assets.length === 0
    ) {
      return null;
    }

    return await processAsset(
      result.assets[0],
      options.maxSize
    );
  } catch (err) {
    console.warn(
      "pickImageFromLibrary error:",
      err
    );
    return null;
  }
}