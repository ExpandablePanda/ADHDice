/**
 * ModalScreen — drop-in replacement for SafeAreaView inside a Modal.
 * SafeAreaView doesn't reliably report top insets when rendered inside a Modal
 * on iOS. This component uses useSafeAreaInsets() directly and applies the
 * correct paddingTop manually.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ModalScreen({ style, children, ...props }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }, style]}
      {...props}
    >
      {children}
    </View>
  );
}
