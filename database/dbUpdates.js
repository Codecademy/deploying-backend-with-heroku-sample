//Update rows in the database
const db = require('./dbConnect.js');

//users
async function RemoveLog(userId) {

  const keyQ = await db.query(
    `
    SELECT room_keys
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  if (keyQ.rows[0].room_keys == 0) throw new Error('User has no logs left!');

  await db.query(
    `
    UPDATE users
    SET room_keys = room_keys - 1 
    WHERE id = $1
    `,
    [userId]
  );

}

module.exports = {
  RemoveLog,
}