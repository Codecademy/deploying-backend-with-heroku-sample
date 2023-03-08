const db = require('./dbConnect.js');

//TRANSACTIONS
async function Begin() {
  await db.query('BEGIN');
}
function Rollback() {
  db.query('ROLLBACK');
}
async function Commit() {
  await db.query('COMMIT');
}

//EXPORT
module.exports = {
  Begin,
  Rollback,
  Commit
};