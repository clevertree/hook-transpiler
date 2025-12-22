module.exports.default = function (context) {
  const theme = {
    colors: { primary: '#2196F3' }
  };
  const { colors: { primary } } = theme;
  
  return (
    <div style={{ padding: 20, backgroundColor: '#eee' }}>
      <text text="Repro Issue Test" style={{ fontSize: 20, color: primary }} />
      <div style={{ marginTop: 10 }}>
         <text text="Nested Text with destructured color" style={{ color: primary }} />
      </div>
    </div>
  ); 
}
