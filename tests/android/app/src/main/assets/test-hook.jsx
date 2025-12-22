module.exports.default = function (context) {
  const theme = {
    colors: {
      primary: '#2196F3',
      secondary: '#FF9800',
      background: '#F5F5F5',
      text: '#333'
    },
    spacing: {
      small: 8,
      medium: 16,
      large: 24
    }
  };

  return (
    <div style={{
      padding: theme.spacing.medium,
      backgroundColor: theme.colors.background
    }}>
      <text text="Test Hook Loaded" style={{
        fontSize: 24,
        color: theme.colors.primary,
        marginBottom: theme.spacing.small
      }} />
      <text text="With Theme Object" style={{
        fontSize: 16,
        color: theme.colors.text,
        marginBottom: theme.spacing.small
      }} />
      <text text="Theme Integrated" style={{
        fontSize: 14,
        color: theme.colors.secondary
      }} />
    </div>
  );
}
