import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/ThemeContext';

export default function ScrollToTop({ scrollRef, showAt = 300 }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  // This component depends on the parent passing scroll events or 
  // we can use a simpler approach where the parent tells us if it's scrolled.
  // Actually, for React Native, we need to listen to onScroll of the ScrollView.
  
  // We'll expose a 'handleScroll' method that the parent calls.
  // But to make it easier, let's just use the 'visible' prop passed from parent.
  // Wait, if I want it to be reusable, the parent should manage the scroll state.

  const handlePress = () => {
    if (scrollRef?.current) {
      // Check if it's a FlatList/SectionList or ScrollView
      if (scrollRef.current.scrollToOffset) {
         scrollRef.current.scrollToOffset({ offset: 0, animated: true });
      } else if (scrollRef.current.scrollTo) {
         scrollRef.current.scrollTo({ y: 0, animated: true });
      } else if (scrollRef.current.scrollToLocation) {
         // SectionList fallback
         scrollRef.current.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
      }
    }
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
      <TouchableOpacity onPress={handlePress} style={styles.button} activeOpacity={0.8}>
        <Ionicons name="arrow-up" size={24} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80, // Above the tab bar
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
  button: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
