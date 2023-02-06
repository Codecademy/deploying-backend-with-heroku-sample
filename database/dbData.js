const db = require('./dbConnect.js');
const balancing = require('../appInfo/balancing');

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
      nodes_0.finished_at
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
async function CampData(campId) {

  const campQ = await db.query(
    `
    SELECT *
    FROM camps
    WHERE id=$1
    `,
    [campId]
  );

  if (campQ.rowCount < 1) throw new Error('there are no camps with that id');
  const camp = campQ.rows[0];

  return camp;
}
async function PlayersInCamp(campId) {

  const playerQuery = await db.query(
    `
    SELECT
        users.id,
        users.name
    FROM nodes_0
    JOIN users ON creator_id = users.id
    WHERE camp_id = $1
    GROUP BY users.id;
    `,
    [campId]
  )

  if (playerQuery.rowCount < 1) throw new Error('found no players in the camp with that id');
  const players = playerQuery.rows;
  return players;

}
async function ScenariosInCamp(campId) {

  const scenarioQ = await db.query(
    `
    SELECT
      scenario,
      creator_id,
      prompt
    FROM scenarios_0
    JOIN nodes_0
    ON scenarios_0.node_id = nodes_0.id
    WHERE nodes_0.camp_id = $1
    AND scenario IS NOT NULL
    ORDER BY nodes_0.id;
    `,
    [campId]
  );

  if (scenarioQ.rowCount < 1) throw new Error('no scenarios in the camp witht that id');

  return scenarioQ.rows;

}
async function ActiveCamps(userId) {

  const campQuery = await db.query(
    `
    SELECT
        camps.id,
        camps.title,
        camps.description,
        users.name AS creator_name,
        COUNT(DISTINCT nodes_0.id) AS node_count,
        COUNT(DISTINCT nodes_0.creator_id) AS contributor_count,
        camps.created_at
    FROM camps
    JOIN users ON users.id = camps.creator_id
    JOIN nodes_0 ON nodes_0.camp_id = camps.id
    WHERE NOT EXISTS(
        SELECT *
        FROM nodes_0
        WHERE creator_id = $1
        AND camp_id = camps.id
    )
    AND finished = 'false'
    GROUP BY camps.id, users.name, camps.title, camps.description
    ORDER BY (COUNT(DISTINCT nodes_0.creator_id) > $2), created_at
    ;
    `,
    [userId, balancing.numbers.maxPlayersForQueueTop]
  );

  // console.log('camp count found: ', campQuery);

  return campQuery.rows;

}
async function PlayerCamps(userId) {

  const campQuery = await db.query(
    `
    SELECT
        camps.id,
        camps.title,
        camps.description,
        users.name AS creator_name,
        COUNT(DISTINCT nodes_0.id) AS node_count,
        COUNT(DISTINCT nodes_0.creator_id) AS contributor_count,
        camps.created_at
    FROM camps
    JOIN users ON users.id = camps.creator_id
    JOIN nodes_0 ON nodes_0.camp_id = camps.id
    WHERE EXISTS(
        SELECT *
        FROM nodes_0
        WHERE creator_id = $1
        AND camp_id = camps.id
    )
    AND finished = 'false'
    GROUP BY camps.id, users.name, camps.title, camps.description
    ORDER BY (COUNT(DISTINCT nodes_0.creator_id) > $2), created_at
    ;
    `,
    [userId, balancing.numbers.maxPlayersForQueueTop]
  );

  return campQuery.rows;

}


//helpers
async function LastNodeInCamp(campId) {

  const last_node_q = await db.query(
    `
    SELECT
      nodes_0.id as node_id,
      creator_id,
      created_at,
      finished_at,
      users.name as creator_name
    FROM nodes_0
    JOIN users on users.id = nodes_0.creator_id
    WHERE camp_id = $1
    ORDER BY nodes_0.id DESC
    LIMIT 1;
    `,
    [campId]
  );
  const node = last_node_q.rows[0];
  return node;

}

//EXPORT
module.exports = {
  Feed,
  LastNodeInCamp,
  CampData,
  PlayersInCamp,
  ScenariosInCamp,
  ActiveCamps,
  PlayerCamps
};