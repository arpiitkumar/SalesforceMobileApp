// components/ImagePickerModal.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  AccessibilityInfo,
} from "react-native";

import Ionicons from "../Ionicons";
import Feather from "@react-native-vector-icons/feather";

import {
  Camera,
  useCameraDevice,
} from "react-native-vision-camera";

import {
  pickImageFromCamera,
  pickImageFromLibrary,
  requestCameraPermissionAndroid,
} from "../../utils/imagePicker";

type Props = {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (
    imageObj: any | null
  ) => void;
  title?: string;
  subtitle?: string;
  cameraButton?: boolean;
  galleryButton?: boolean;
};

export default function ImagePickerModal({
  visible,
  onClose,
  onImageSelected,
  title = "Upload Image",
  subtitle = "Take a fresh photo or choose from your gallery",
  cameraButton = true,
  galleryButton = false,
}: Props) {
  const [busy, setBusy] =
    useState(false);

  const [showCamera, setShowCamera] =
    useState(false);

  const [
    hasCamPermission,
    setHasCamPermission,
  ] = useState(false);

  const [cameraType, setCameraType] =
    useState<"front" | "back">(
      "back"
    );

  const scale = useRef(
    new Animated.Value(0.96)
  ).current;

  const opacity = useRef(
    new Animated.Value(0)
  ).current;

  const cameraRef = useRef<any>(null);

  const device =
    useCameraDevice(cameraType);

  const fallbackDevice =
    useCameraDevice("front");

  const finalDevice =
    device ?? fallbackDevice;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(
            Easing.cubic
          ),
        }),

        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
          easing: Easing.out(
            Easing.linear
          ),
        }),
      ]).start(() => {
        AccessibilityInfo.isScreenReaderEnabled().then(
          (enabled) => {
            if (enabled) {
              AccessibilityInfo.announceForAccessibility(
                title
              );
            }
          }
        );
      });
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.96,
          duration: 140,
          useNativeDriver: true,
          easing: Easing.in(
            Easing.cubic
          ),
        }),

        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
          easing: Easing.in(
            Easing.linear
          ),
        }),
      ]).start();
    }
  }, [
    visible,
    scale,
    opacity,
    title,
  ]);

  /**
   * OPEN CAMERA
   */
  const handleCamera = async () => {
    try {
      setBusy(true);

      const allowed =
        await requestCameraPermissionAndroid();

      if (!allowed) {
        setBusy(false);
        return;
      }

      setHasCamPermission(true);

      setShowCamera(true);
    } catch (e) {
      console.log(
        "Permission error:",
        e
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * CAPTURE PHOTO
   * SAME RESPONSE
   */
  const capturePhoto = async () => {
    try {
      setBusy(true);

      const img =
        await pickImageFromCamera({
          cameraRef,
        });

      setShowCamera(false);

      onImageSelected(img);
    } catch (e) {
      console.log(
        "Capture error:",
        e
      );
    } finally {
      setBusy(false);
      onClose();
    }
  };

  /**
   * GALLERY
   */
  const handleLibrary = async () => {
    setBusy(true);

    try {
      const img =
        await pickImageFromLibrary();

      onImageSelected(img);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <>
      {/* MAIN PICKER MODAL */}

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (!busy) onClose();
        }}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [
                  { scale },
                ],
                opacity,
              },
            ]}
          >
            <View
              style={styles.headerRow}
            >
              <View>
                <Text
                  style={styles.title}
                >
                  {title}
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                >
                  {subtitle}
                </Text>
              </View>

              <TouchableOpacity
                accessible
                accessibilityLabel="Close"
                onPress={() => {
                  if (!busy)
                    onClose();
                }}
                style={
                  styles.closeBtn
                }
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color="#444"
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.optionsWrap
              }
            >
              {/* CAMERA */}

              <TouchableOpacity
                style={[
                  styles.outlineBtn,
                  (!cameraButton ||
                    busy) && {
                    opacity: 0.4,
                  },
                ]}
                onPress={
                  handleCamera
                }
                activeOpacity={0.9}
                disabled={
                  !cameraButton ||
                  busy
                }
              >
                <View
                  style={
                    styles.outlineContent
                  }
                >
                  <View
                    style={
                      styles.iconCircleOutline
                    }
                  >
                    <Ionicons
                      name="camera"
                      size={20}
                      color="#1E3A8A"
                    />
                  </View>

                  <Text
                    style={
                      styles.outlineText
                    }
                  >
                    Take Photo
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#1E3A8A"
                />
              </TouchableOpacity>

              {/* GALLERY */}

              <TouchableOpacity
                style={[
                  styles.outlineBtn,
                  (!galleryButton ||
                    busy) && {
                    opacity: 0.4,
                  },
                ]}
                onPress={
                  handleLibrary
                }
                activeOpacity={0.9}
                disabled={
                  !galleryButton ||
                  busy
                }
              >
                <View
                  style={
                    styles.outlineContent
                  }
                >
                  <View
                    style={
                      styles.iconCircleOutline
                    }
                  >
                    <Ionicons
                      name="images"
                      size={18}
                      color="#1E3A8A"
                    />
                  </View>

                  <Text
                    style={
                      styles.outlineText
                    }
                  >
                    Choose from
                    Library
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#1E3A8A"
                />
              </TouchableOpacity>

              {/* CANCEL */}

              <TouchableOpacity
                style={
                  styles.ghostBtn
                }
                onPress={() => {
                  if (!busy)
                    onClose();
                }}
                activeOpacity={0.8}
                disabled={busy}
              >
                <Text
                  style={
                    styles.ghostText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>

            {busy && (
              <View
                style={
                  styles.busyOverlay
                }
              >
                <ActivityIndicator size="large" />
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* CAMERA MODAL */}

      <Modal
        visible={showCamera}
        animationType="slide"
      >
        {finalDevice &&
        hasCamPermission ? (
          <View
            style={{
              flex: 1,
              backgroundColor:
                "#000",
            }}
          >
            <Camera
              ref={cameraRef}
              style={{ flex: 1 }}
              device={finalDevice}
              isActive={
                showCamera
              }
              photo={true}
            />

            {/* CAPTURE */}

            <TouchableOpacity
              onPress={
                capturePhoto
              }
              style={{
                position:
                  "absolute",
                bottom: 50,
                alignSelf:
                  "center",
                backgroundColor:
                  "#C9A24D",
                padding: 20,
                borderRadius: 50,
              }}
            >
              <Ionicons
                name="camera"
                size={30}
                color="#fff"
              />
            </TouchableOpacity>

            {/* SWITCH CAMERA */}

            <TouchableOpacity
              onPress={() => {
                setCameraType(
                  (prev) =>
                    prev ===
                    "front"
                      ? "back"
                      : "front"
                );
              }}
              style={{
                position:
                  "absolute",
                top: 50,
                left: 20,
                backgroundColor:
                  "#00000080",
                padding: 10,
                borderRadius: 30,
              }}
            >
              <Ionicons
                name="camera-reverse"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            {/* CLOSE */}

            <TouchableOpacity
              onPress={() =>
                setShowCamera(
                  false
                )
              }
              style={{
                position:
                  "absolute",
                top: 50,
                right: 20,
                backgroundColor:
                  "#00000080",
                padding: 10,
                borderRadius: 10,
              }}
            >
              <Feather
                name="x"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              justifyContent:
                "center",
              alignItems:
                "center",
            }}
          >
            <ActivityIndicator
              size="large"
              color="#C9A24D"
            />
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor:
      "rgba(6,10,21,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },

  sheet: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },

  headerRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F1D1A",
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 13,
    color: "#6b6f76",
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f8fb",
    borderWidth: 1,
    borderColor: "#eef1f7",
  },

  optionsWrap: {
    marginTop: 4,
  },

  outlineBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6eefc",
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 12,
  },

  outlineContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconCircleOutline: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#eef4ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  outlineText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E3A8A",
  },

  ghostBtn: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },

  ghostText: {
    fontSize: 15,
    color: "#6b6f76",
    fontWeight: "600",
  },

  busyOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor:
      "rgba(255,255,255,0.6)",
  },
});