import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import HeaderMain from '../components/HeaderMain';
export default function DocumentViewer({ route, navigation }) {

  const { type, url, heading } = route.params;
  console.log('url...', url, type, heading)

  // Three static URLs for different document types
  // const videoUrl = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
  // const pdfUrl = "https://www.orimi.com/pdf-test.pdf";
  // const pptUrl = "https://scholar.harvard.edu/files/torman_personal/files/samplepptx.pptx";

  // Type state - you can change this to 'video', 'pdf', or 'ppt'
  //const [type, setType] = useState('ppt'); // Starting with PPT to test

  // Function to create HTML video player
  const createVideoHtml = (urlParam) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 20px;
            background-color: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          video {
            width: 100%;
            height: auto;
            max-width: 100%;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <video controls autoplay muted playsinline>
          <source src="${urlParam}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </body>
      </html>
    `;
  };

  // Function to get the appropriate source based on type
  const getSource = () => {
    switch (type) {
      case 'Video':
        // Return HTML content with video player
        return { html: createVideoHtml(url) };
      case 'PDF':
        // Google Docs viewer for PDF
        return { uri: `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true` };
      case 'PPT':
        // Google Docs viewer for PPT (since Microsoft viewer was failing)
        return { uri: `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true` };
      default:
        return { uri: url };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header showing current type */}
      {/* <View style={styles.header}>
        <Text style={styles.headerText}>Current Type: {type.toUpperCase()}</Text>
        <Text style={styles.subHeaderText}>
          {type === 'PPT' ? 'Using Google Docs Viewer' : ''}
        </Text>
      </View> */}


      <HeaderMain screenName={heading} />
      {/* Buttons to change document type */}
      {/* <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, type === 'video' && styles.activeButton]}
          onPress={() => setType('video')}
        >
          <Text style={[styles.buttonText, type === 'video' && styles.activeButtonText]}>Video</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, type === 'pdf' && styles.activeButton]}
          onPress={() => setType('pdf')}
        >
          <Text style={[styles.buttonText, type === 'pdf' && styles.activeButtonText]}>PDF</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, type === 'ppt' && styles.activeButton]}
          onPress={() => setType('ppt')}
        >
          <Text style={[styles.buttonText, type === 'ppt' && styles.activeButtonText]}>PPT</Text>
        </TouchableOpacity>
      </View> */}

      {/* WebView to render the document */}
      <View style={{ backgroundColor: 'white', flex: 1, borderRadius: 20, borderBottomRightRadius: 0, borderBottomLeftRadius: 0, overflow: 'hidden' }}>
        <WebView
          source={getSource()}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          // Video-specific props
          allowsInlineMediaPlaybook={true}
          mediaPlaybackRequiresUserAction={false}
          // Allow autoplay
          allowsFullscreenVideo={true}
          // For iOS
          bounces={false}
          scrollEnabled={true}
          // Add loading indicator
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading {type.toUpperCase()}...</Text>
            </View>
          )}
        />
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#F1EADB', 
    backgroundColor: '#A67C2E',
  },
  header: {
    backgroundColor: '#A67C2E',
    padding: 15,
    alignItems: 'center',
  },
  webview: {
    flex: 1,
    borderRadius: 60,
    overflow: 'hidden', // Important for Android
    //margin: 10,
    // Optional: Add space around it
    backgroundColor: 'white',
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subHeaderText: {
    color: 'white',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  button: {
    backgroundColor: '#D9D2C3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  activeButton: {
    backgroundColor: '#3B5BB5',
  },
  buttonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  activeButtonText: {
    color: 'white',
  },

  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },

});
