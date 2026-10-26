import React from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import HeaderMain from './HeaderMain';

const TRAINING_MATERIALS_URL =
  'https://emamiagrotech.sharepoint.com/sites/Projectsrijan/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=cAylfz&CID=b7b2446a%2D1b6c%2D4204%2D8f70%2D0cc8b7e54c02&FolderCTID=0x012000C6B8B38A69E61745AD5BDA4B5B2946CE&id=%2Fsites%2FProjectsrijan%2FShared%20Documents%2FGeneral%2FProject%20Srijan%2FTraining%20Material%2D%2DVideos%2C%20Documentation';

const TrainingMaterialsScreen = () => {
  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#A67C2E" />
      <View style={styles.headerContainer}>
        <HeaderMain screenName="Training Materials" />
      </View>

      <View style={styles.webContainer}>
        <WebView
          source={{ uri: TRAINING_MATERIALS_URL }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#C9A24D" />
            </View>
          )}
        />
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#A67C2E',
  },
  headerContainer: {
    backgroundColor: '#A67C2E',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default TrainingMaterialsScreen;
