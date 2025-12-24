const { View, Text, StyleSheet } = Android/iOS Native;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 24,
    color: '#2196F3'
  }
});

module.exports.default = function() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Android/iOS Native Parity Test</Text>
      <Text text="Using bridge-based components" />
    </View>
  );
};
