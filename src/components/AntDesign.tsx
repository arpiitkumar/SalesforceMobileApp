import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface AntDesignProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export default function AntDesign({ name, size = 24, color = '#000', style }: AntDesignProps) {
  const iconName = name ? name.toLowerCase() : '';

  let paths = null;

  switch (iconName) {
    case 'down':
      paths = (
        <Path
          d="M6 9l6 6 6-6"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'up':
      paths = (
        <Path
          d="M18 15l-6-6-6 6"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'close':
    case 'closecircle':
    case 'closecircleo':
      if (iconName === 'closecircle' || iconName === 'closecircleo') {
        paths = (
          <>
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
            <Path
              d="M15 9l-6 6M9 9l6 6"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );
      } else {
        paths = (
          <Path
            d="M18 6L6 18M6 6l12 12"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      }
      break;

    case 'profile':
      paths = (
        <>
          <Path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case 'infocirlce':
    case 'infocircle':
    case 'infocirlceo':
    case 'infocircleo':
      paths = (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M12 16v-4M12 8h.01"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    default:
      // Fallback
      paths = (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M12 16v-4M12 8h.01"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;
  }

  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths}
      </Svg>
    </View>
  );
}
