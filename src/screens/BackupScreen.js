import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function BackupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Backup</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.textSecondary, fontSize: 18 },
});
