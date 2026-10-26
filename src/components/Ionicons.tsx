import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface IoniconsProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export default function Ionicons({ name, size = 24, color = '#000', style }: IoniconsProps) {
  // Normalize icon names (remove outline suffix if we use unified outline style)
  const iconName = name ? name.toLowerCase() : '';

  let paths = null;

  switch (iconName) {
    case 'camera':
    case 'camera-outline':
      paths = (
        <>
          <Path
            d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth="2" fill="none" />
        </>
      );
      break;

    case 'camera-reverse':
    case 'camera-reverse-outline':
      paths = (
        <>
          <Path
            d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 13l-2 2 2 2"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M7 15h5a3 3 0 0 0 3-3v-1"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M15 17l2-2-2-2"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M17 15h-5a3 3 0 0 0-3 3v1"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
      break;

    case 'close':
    case 'close-circle':
    case 'close-outline':
      if (iconName === 'close-circle') {
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

    case 'chevron-down':
    case 'chevron-down-outline':
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

    case 'chevron-up':
    case 'chevron-up-outline':
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

    case 'chevron-forward':
    case 'chevron-forward-outline':
      paths = (
        <Path
          d="M9 18l6-6-6-6"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'chevron-back':
    case 'chevron-back-outline':
      paths = (
        <Path
          d="M15 19l-7-7 7-7"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'trash':
    case 'trash-outline':
    case 'trash-2':
    case 'trash-bin':
      paths = (
        <Path
          d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'person':
    case 'person-outline':
      paths = (
        <>
          <Path
            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" fill="none" />
        </>
      );
      break;

    case 'trophy':
      paths = (
        <Path
          d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a7 7 0 0 0-7 7c0 2.22 1.03 4.2 2.66 5.5h8.68A6.97 6.97 0 0 0 19 9a7 7 0 0 0-7-7z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'sync':
    case 'refresh':
      paths = (
        <Path
          d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'gift':
      paths = (
        <Path
          d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'arrow-back':
      paths = (
        <Path
          d="M19 12H5M12 19l-7-7 7-7"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'arrow-back-circle':
      paths = (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M12 8l-4 4 4 4M8 12h8"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case 'add-circle':
      paths = (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M12 8v8M8 12h8"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case 'remove-circle':
    case 'remove-circle-outline':
      paths = (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M8 12h8"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case 'ban':
      paths = (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M4.93 4.93l14.14 14.14"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
      break;

    case 'image':
    case 'image-outline':
      paths = (
        <>
          <Path
            d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="8.5" cy="8.5" r="1.5" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M21 15l-5-5L5 21"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case 'information-circle-outline':
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

    case 'pricetags':
      paths = (
        <Path
          d="M12 2H2v10l9 9a1.5 1.5 0 0 0 2.1 0l7.9-7.9a1.5 1.5 0 0 0 0-2.1L12 2zM6 6h.01"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'images':
      paths = (
        <Path
          d="M15 8v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2zm8-5v11a2 2 0 0 1-2 2h-2m-2-11V3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-2"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'search':
      paths = (
        <>
          <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M21 21l-4.35-4.35"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case 'settings-outline':
      paths = (
        <>
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
      break;

    case 'walk-outline':
      paths = (
        <>
          <Circle cx="13" cy="4" r="2" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M13 18l-3-6 1-4 2 2m-3 2l-2-2 3-5h2m-6 17l4-5M15 13l2 5"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case 'business-outline':
      paths = (
        <Path
          d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 9h0M15 9h0M9 13h0M15 13h0M9 17h0M15 17h0"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'people-outline':
      paths = (
        <>
          <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
          <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" fill="none" />
          <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </>
      );
      break;

    case 'search-outline':
      paths = (
        <>
          <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" fill="none" />
          <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
      break;

    case 'cafe-outline':
      paths = (
        <Path
          d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 2v2M10 2v2M14 2v2"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'document-outline':
      paths = (
        <Path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'document-text-outline':
      paths = (
        <>
          <Path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M14 2v6h6M16 13H8M16 17H8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
      break;

    case 'radio-button-on':
      paths = (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
          <Circle cx="12" cy="12" r="5" fill={color} />
        </>
      );
      break;

    case 'radio-button-off':
      paths = (
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
      );
      break;

    case 'checkbox':
      paths = (
        <>
          <Path
            d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
      break;

    case 'square-outline':
      paths = (
        <Path
          d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
      break;

    case 'funnel':
    case 'funnel-outline':
      paths = (
        <Path
          d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={iconName === 'funnel' ? color : 'none'}
        />
      );
      break;

    case 'checkmark':
    case 'checkmark-outline':
      paths = (
        <Path
          d="M20 6L9 17l-5-5"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'checkmark-circle':
    case 'checkmark-circle-outline':
      paths = (
        <>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
          <Path
            d="M8 12l3 3 5-5"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case 'arrow-up':
      paths = (
        <Path
          d="M12 19V5M5 12l7-7 7 7"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'arrow-down':
      paths = (
        <Path
          d="M12 5v14M19 12l-7 7-7-7"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;

    case 'star':
      paths = (
        <Path
          d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          fill={color}
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      );
      break;

    case 'star-outline':
      paths = (
        <Path
          d="M12 18.26l-5.89 3.59 1.57-6.79-5.17-4.5 6.95-.6L12 3.5l2.54 6.46 6.95.6-5.17 4.5 1.57 6.79z"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      );
      break;

    default:
      // Default info circle fallback for any unmapped icon names
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
