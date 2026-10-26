import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image
} from "react-native";
import Icon from "../Ionicons";
import { navigate } from "../../navigationRef";
import AntDesign from "../AntDesign";
import { submitApprovalAction } from "../../UtilityMain/notificationApproval";
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";
import { recalculateNotificationCount } from "../../utils/notificationCounter";

const { width } = Dimensions.get("window");

const ForegroundNotification = ({
  visible,
  Id,
  objectName,
  title,
  message,
  image,
  type,
  actionId,
  approvalType,
  sfId,
  onHide,
}) => {
  const slideAnim = useRef(new Animated.Value(-120)).current;

  const handleNotificationPress = () => {
    if (!Id || !objectName) return;

    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onHide && onHide();

      navigate("ObjectDetail", {
        Id,
        objectName,
      });
    });
  };

  const handleApprovalAction = async (decision) => {
    if (!actionId) return;
    try {
      const comments = decision === 'Approve' ? 'Approved via Mobile APK' : 'Rejected via Mobile APK';
      const res = await submitApprovalAction(decision, actionId, comments);
      if (res.status === 'success' && sfId) {
        await UniversalUpdateInsert({
          ObjectName: 'Notification__c',
          Type: 'insert',
          data: {
            Sf_Id: sfId,
            Status: decision === 'Approve' ? 'approved' : 'rejected',
            last_modified: Date.now(),
          },
        });
        await recalculateNotificationCount();
      }
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onHide && onHide();
      });
    } catch (err) {
      console.log('Approval action error:', err);
    }
  };

  const handleClosePress = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onHide && onHide();
    });
  };

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 40,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onHide && onHide();
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const isApproval = type?.toLowerCase() === 'approval' && !!actionId;

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.tappable} onPress={handleNotificationPress} activeOpacity={0.8}>
          <Icon name="notifications" size={22} color="#fff" />
          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message} numberOfLines={2}>{message}</Text>
            {approvalType ? <Text style={styles.approvalType}>Approval For: {approvalType}</Text> : null}
            {type?.toLowerCase() === 'image' && image && (
              <Image
                source={{ uri: image }}
                style={styles.image}
                resizeMode="cover"
              />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.closeIcon}
          onPress={handleClosePress}
          activeOpacity={0.7}
        >
          <AntDesign name="closecircle" color="#fff" size={24} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

export default ForegroundNotification;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: -5,
    alignSelf: "center",
    width: width - 20,
    zIndex: 9999,
  },
  container: {
    backgroundColor: "#1F1D1A",
    borderRadius: 14,
    padding: 16,
    paddingRight: 40,
    flexDirection: "row",
    alignItems: "center",
    elevation: 6,
  },
  tappable: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  message: {
    color: "#D9D2C3",
    fontSize: 13,
    marginTop: 2,
  },
  approvalType: {
    color: "#fbbf24",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  closeIcon: {
    position: "absolute",
    top: 10,
    right: 12,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 10,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8,
  },
  approveBtn: {
    backgroundColor: "#2E7D5B",
  },
  rejectBtn: {
    backgroundColor: "#B3261E",
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
  },
  image: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    marginTop: 8,
  },
});