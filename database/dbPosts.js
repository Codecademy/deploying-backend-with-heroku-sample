//POST STUFF TO THE DATABASE
const db = require('./dbConnect.js');
const dbData = require('./dbData');

//NODES
async function Node(campId, userId) {

  const q = await db.query(
    `
    SELECT finished_at, id
    FROM nodes_0
    WHERE camp_id = $1
    ORDER BY id DESC
    LIMIT 1;
    `,
    [campId]
  );

  const { finished_at } = q.rows[0];
  const last_node_id = q.rows[0].id;

  if (finished_at) {

    //the last node is finished, and we need to add one
    const nodeQ = await db.query(
      `
      INSERT INTO nodes_0 (creator_id, camp_id)
      VALUES ($1, $2)
      RETURNING id
      `,
      [userId, campId]
    );
    const newNodeId = nodeQ.rows[0].id;
    const scenarioAddQ = await db.query(
      `
      INSERT INTO scenarios_0 (node_id, prompt)
      VALUES (
          $1,
          (SELECT prompt FROM prompts ORDER BY random() LIMIT 1)
      )
      RETURNING prompt;
      `,
      [newNodeId]
    )
    const { prompt } = scenarioAddQ.rows[0];
    return prompt;

  }
  else {

    //the last node is NOT finished, and we need to update it
    await db.query(
      `
      UPDATE nodes_0
      SET
          creator_id = $1,
          created_at = NOW()
      WHERE
      finished_at IS NULL
      AND camp_id = $2
      `,
      [userId, campId]
    );
    const scenarioQ = await db.query(
      `
      SELECT prompt
      FROM scenarios_0
      WHERE node_id = $1
      `,
      [last_node_id]
    )
    const { prompt } = scenarioQ.rows[0];
    return prompt;

  }



}
async function Scenario(campId, text, isEnd) {

  const lastNode = await dbData.LastNodeInCamp(campId);
  const lastNodeId = lastNode.node_id;

  //insert text into scenarios
  await db.query(
    `
    UPDATE scenarios_0
    SET scenario = $1
    WHERE node_id = $2
    `,
    [text, lastNodeId]
  );

  //add a finished at stamp in the node
  await db.query(
    `
    UPDATE nodes_0
    SET finished_at = now()
    WHERE id = $1
    `,
    [lastNodeId]
  );

  if (!isEnd) return;

  //if end

  //set camp to finished
  await db.query(
    `
    UPDATE camps
    SET finished = 'true'
    WHERE id = $1
    `,
    [campId]
  );

  //hand out logs to every participant
  await db.query(
    `
    WITH players_in_camp AS (
      SELECT creator_id
      FROM nodes_0
      WHERE camp_id = $1
      GROUP BY creator_id
    )
    UPDATE users
    SET room_keys = room_keys + 1 
    FROM players_in_camp
    WHERE users.id = players_in_camp.creator_id
    `,
    [campId]
  );

}

//CAMPS
async function Camp(title, description, scenario, creator_id) {

  const campTitleQ = await db.query(
    `
    SELECT id
    FROM camps
    WHERE title = $1
    `,
    [title]
  );

  if (campTitleQ.rowCount > 0) throw new Error('Story title already exists.');

  const campQ = await db.query(
    `
    WITH new_camp AS(
        INSERT INTO camps(title, description, creator_id)
        VALUES($1, $2, $3)
        RETURNING id
    ), new_node AS (
        INSERT INTO nodes_0 (creator_id, camp_id, finished_at)
        VALUES ($3, (SELECT id FROM new_camp), now())
        RETURNING id
    )
    INSERT INTO scenarios_0 (scenario, node_id)
    VALUES ($4, (SELECT id FROM new_node))
    RETURNING (SELECT id FROM new_camp);
    `
    ,
    [title, description, creator_id, scenario]
  );
  const campId = campQ.rows[0].id;
  return campId;

}

module.exports = {
  AddNode: Node,
  AddScenario: Scenario,
  Camp
};