import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";

const TopPerformingOLCard = ({ title, top10Account = [] }) => {
  const [open, setOpen] = useState(false);
const formatAmount = (amount = 0) =>
  Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <View
      style={{
        marginVertical: 12,
        marginHorizontal:3,
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 2,
        overflow: "hidden",
      }}
    >
      {/* 🔹 Header */}
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={{
          padding: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#EEF4FF",
          borderBottomWidth: open ? 1 : 0,
          borderColor: "#D6E2FF",
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: "#A67C2E",
          }}
        >
          {title}
        </Text>

        <View
          style={{
            backgroundColor: "#C9A24D",
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 12 }}>
            {open ? "HIDE" : "SHOW"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 🔹 Body */}
      {open && (
        <View style={{ padding: 14 }}>
          {top10Account?.length === 0 ? (
            // 🚫 Empty State
            <Text
              style={{
                textAlign: "center",
                color: "#999",
                fontSize: 14,
                paddingVertical: 12,
              }}
            >
              No account found
            </Text>
          ) : (
            top10Account?.map((item, index) => (
              <View
                key={item.customerId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth:
                    index === top10Account.length - 1 ? 0 : 0.5,
                  borderColor: "#EEE",
                }}
              >
                {/* 🏅 Rank */}
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor:
                      index === 0
                        ? "#FFD700"
                        : index === 1
                        ? "#C0C0C0"
                        : "#D9D2C3",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 10,
                  }}
                >
                  <Text style={{ fontWeight: "700", fontSize: 12 }}>
                    {index + 1}
                  </Text>
                </View>

                {/* 📛 Name */}
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: index < 2 ? "700" : "500",
                    color: "#1F1D1A",
                  }}
                >
                  {item.customerName}
                </Text>

                {/* 💰 Amount */}
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#2E7D5B",
                  }}
                >
                  ₹ {formatAmount(item.totalNetAmount)}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
};

export default TopPerformingOLCard;
