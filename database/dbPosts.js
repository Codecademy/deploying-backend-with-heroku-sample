//POST STUFF TO THE DATABASE
const db = require('./dbConnect.js');

//NODES
async function AddNode(campId, userId) {

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

async function AddScenario(campId, text, isEnd) {

  // const scenarioId = await dbFunctions.AddScenario(text, campId, userId);

  const q = await db.query(
    `
    
    `
  )

  // if (isEnd) {
  //   await dbFunctions.EndStory(campId);
  // }
  // else {
  //   await dbFunctions.CreateNewNode(campId);
  //   await dbFunctions.PassTurn(room, userId);
  //   await dbFunctions.UpdateCharCount(text, campId, userId);
  // }

}

module.exports = {
  AddNode,
  AddScenario
};