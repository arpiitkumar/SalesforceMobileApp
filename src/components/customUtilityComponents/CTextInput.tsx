import React from "react";
import { TextInput } from "react-native";

const CTextInput = ({
  value,
  onChangeText,
  validationType = "none",
  maxLengthAllowed,
  minValue,
  ...rest
}) => {
  const handleChange = (text) => {
    switch (validationType) {
      case "numeric":
        if (!/^\d*$/.test(text)) return;
        break;

      case "price":
        // allow digits and ONE decimal point
        if (!/^\d*\.?\d*$/.test(text)) return;

        if (maxLengthAllowed && text.length > maxLengthAllowed) return;

        //  DO NOT validate minValue here — do it on blur/submit
        break;
      case "phone":
        if (!/^\d*$/.test(text)) return;
        if (text.length > 10) return;
        break;

      case "email":
        // allow typing freely, validate later
        break;

      case "text":
        // allow only letters, numbers, and spaces
        if (!/^[a-zA-Z0-9 ]*$/.test(text)) return;
        break;

      default:
        break;
    }

    onChangeText(text);
  };

  return (
    <TextInput
      {...rest}
      value={value}
      onChangeText={handleChange}
      maxLength={maxLengthAllowed}
    />
  );
};

export default CTextInput;
