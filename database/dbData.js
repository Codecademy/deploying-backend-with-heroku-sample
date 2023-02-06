const db = require('./dbConnect.js');

//request to app
async function Feed() {

  const q = await db.query(
    `SELECT
      camps.title AS story_title,
      camps.id AS room_id,
      nodes_0.creator_id AS creator_id,
      users.name AS creator_name,
      nodes_0.id AS scenario_id,
      scenarios_0.scenario,
      nodes_0.created_at
    FROM nodes_0
    JOIN scenarios_0 ON scenarios_0.node_id = nodes_0.id
    JOIN camps ON camps.id = nodes_0.camp_id
    JOIN users ON users.id = nodes_0.creator_id
    WHERE scenarios_0.scenario IS NOT NULL
    ORDER BY nodes_0.id DESC
    LIMIT 25`
  );

  return q.rows;

}

//helpers
async function LastNodeInCamp(campId) {

  const last_node_q = await db.query(
    `
    SELECT id
    FROM nodes_0
    WHERE camp_id = $1
    ORDER BY id DESC
    LIMIT 1;
    `,
    [campId]
  );
  const { last_node_id } = last_node_q.rows[0];
  return last_node_id;

}

//EXPORT
module.exports = {
  Feed,
  LastNodeInCamp
};