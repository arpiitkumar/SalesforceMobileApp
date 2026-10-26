import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * RippleBackground
 * - Wrap any element (button) with this to show expanding ripple waves behind it.
 *
 * Props:
 * - children: React node
 * - rippleColor: color of the wave (default: '#C9A24D')
 * - rippleCount: how many overlapping ripples (default: 3)
 * - duration: single ripple duration in ms (default: 2000)
 * - maxRadius: target radius in px. default is half screen width (SCREEN_W / 2)
 * - style: style applied to wrapper (optional)
 * - running: boolean to start/stop animations (default true)
 */
export default function RippleBackground({
  children,
  rippleColor = '#C9A24D',
  rippleCount = 3,
  duration = 2000,
  maxRadius = Math.round(SCREEN_W / 2.4),
  style,
  running = true,
}) {
  // animated values for each ripple
  const scales = useRef(new Array(rippleCount).fill(0).map(() => new Animated.Value(0))).current;
  const anims = useRef([]).current;

  useEffect(() => {
    // start loops per ripple
    if (!running) return;

    scales.forEach((scale, i) => {
      // For each ripple: delay to stagger, then animate scale 0 -> 1, then reset to 0 instantly, loop forever
      const delay = Math.round((i * duration) / rippleCount);

      const single = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(scale, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          // immediately reset to 0 so next loop restarts
          Animated.timing(scale, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      anims.push(single);
      single.start();
    });

    return () => {
      // cleanup: stop all animations
      anims.forEach(a => a && a.stop && a.stop());
      // reset animated values
      scales.forEach(s => s.setValue(0));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, duration, rippleCount, maxRadius]);

  // circle size equals diameter
  const diameter = maxRadius * 2;

  return (
    <View pointerEvents="box-none" style={[styles.container, style]}>
      {/* Ripples (absolute) */}
      <View pointerEvents="none" style={[styles.rippleLayer, { width: diameter, height: diameter }]}>
        {scales.map((scale, i) => {
          // opacity interpolates: start visible, fade to 0 near end
          const opacity = scale.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0.35, 0.12, 0], // tweak for nicer fading
          });

          // To make inner ripples look slightly different you can reduce final opacity or size per ripple
          const rippleStyle = {
            position: 'absolute',
            width: diameter,
            height: diameter,
            borderRadius: maxRadius,
            transform: [{ scale }],
            opacity,
            backgroundColor: rippleColor,
          };

          // Slightly reduce the size or opacity for later ripples (optional subtle variation)
          return <Animated.View key={i} style={rippleStyle} />;
        })}
      </View>

      {/* Centered content (your button) */}
      <View style={styles.content} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // container must be large enough to show ripples
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    // center origin so scale grows from center
    overflow: 'visible',
  },
  content: {
    // content sits on top of ripple layer
    alignItems: 'center',
    justifyContent: 'center',
  },
});
