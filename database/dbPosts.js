//POST STUFF TO THE DATABASE
const db = require('./dbConnect.js');

//NODES
async function AddNode(campId, userId) {

  const q = await db.query(
    `
    SELECT finished_at
    FROM nodes_0
    WHERE camp_id = $1
    ORDER BY id DESC
    LIMIT 1;
    `,
    [campId]
  );

  const { finished_at } = q.rows[0];

  if (finished_at) {
    await db.query(
      `
      INSERT INTO nodes_0 (creator_id, camp_id)
      VALUES ($1, $2)
      `,
      [userId, campId]
    );
  }
  else {
    await db.query(
      `
      UPDATE nodes_0
      SET
          creator_id = $1,
          created_at = NOW()
      WHERE
      finished_at IS NULL
      AND camp_id = $2;
      `,
      [userId, campId]
    );
  }

}

module.exports = {
  AddNode
};