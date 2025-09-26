const express = require('express');
const path = require('path');
const app = express();
const PORT = 5001;

const chatAppPath = __dirname;

// 1. Sirve archivos estáticos (como css, js, etc.) desde la carpeta 'chat-vanilla'
app.use(express.static(chatAppPath));

console.log(`Sirviendo archivos estáticos desde: ${chatAppPath}`);

// 2. Para cualquier otra petición que no sea un archivo estático, sirve el index.html
// Esto permite que la app funcione como una Single Page Application (SPA)
app.use((req, res) => {
  res.sendFile(path.join(chatAppPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ Servidor del Chat Frontend iniciado.`);
  console.log(`   ==================================================`);
  console.log(`   👉 Abre tu navegador en: http://localhost:${PORT}`);
  console.log(`   ==================================================\n`);
});