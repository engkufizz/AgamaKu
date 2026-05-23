const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('d:/Tengku/AgamaKu/agamaku.db');
db.all('SELECT id, name, coordinates, online FROM teachers', (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
  db.close();
});
