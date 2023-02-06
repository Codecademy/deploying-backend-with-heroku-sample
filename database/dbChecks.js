//CHECKS STUFF IN THE DATABASE AND THROWS ERRORS IF THEY ARE FALSE
const db = require('./dbConnect.js');

//ERROR CHECKS
async function CanAddNode(campId, userId) {

  const q = await db.query(
    `
    SELECT
        camps.finished,
        nodes_0.creator_id AS last_node_creator_id,
        nodes_0.created_at AS last_node_posted_at,
        nodes_0.finished_at AS last_node_finished_at
    FROM camps
    JOIN nodes_0 on nodes_0.camp_id = camps.id
    WHERE camps.id = $1
    ORDER BY nodes_0.id DESC
    LIMIT 1;
    `,
    [campId]
  );

  if (q.rowCount == 0) throw new Error('there is no camp with that id');

  const { finished, last_node_creator_id, last_node_posted_at, last_node_finished_at } = q.rows[0];

  console.log('user id is ', userId);
  console.log('last node added by: ', last_node_creator_id);

  if (finished) throw new Error('Cant add node, story is already finished');
  if (last_node_creator_id == userId) throw new Error('Cant add node, because user added the last one');

  //check if someone else is writing
  if (last_node_finished_at) return;
  const last_node_time = (new Date(last_node_posted_at)).getTime();
  const current_time = (new Date()).getTime();
  const diff = current_time - last_node_time;
  const diffInMinutes = diff / 1000 / 60;
  if (diffInMinutes < 20) {
    throw new Error('Cant add node. Another player is currently writing');
  }

}

async function CanAddScenario(campId, userId, isEnd) {

  const q = await db.query(
    `
    SELECT
        nodes_0.creator_id AS node_creator_id,
        finished_at AS node_finish_time,
        scenario,
        camps.finished AS camp_finished
    FROM nodes_0
    LEFT JOIN scenarios_0 ON scenarios_0.node_id = nodes_0.id
    JOIN camps ON camps.id = nodes_0.camp_id
    WHERE camp_id = 59
    ORDER BY nodes_0.id;
    `,
    [campId]
  );

  const nodeCount = q.rowCount;
  const lastNode = q.rows[q.rows.length - 1];
  const lastPosterId = lastNode.node_creator_id;
  const lastNodeEmpty = (lastNode.node_finish_time == null)
  const scenario = lastNode.scenario;
  const campFinished = lastNode.camp_finished;

  if (!lastNodeEmpty) throw new Error('Cant add scenario, because the last node is marked as finished');
  if (!lastPosterId != userId) throw new Error('Cant add scenario, because someone else owns the node');
  if (isEnd && nodeCount < 30) throw new Error('Cant add end, because the story is not long enough. Current nodecount: ', nodeCount);
  if (!isEnd && nodeCount == 40) throw new Error('Cant add scenario. Must add end, because the story has reached its max length: ', nodeCount);
  if (campFinished) throw new Error('cant add scenario, story marked as finished');
  if (scenario) throw new Error('Cant add scenario, there already exist one linked to the last node');

}

module.exports = {
  CanAddNode,
  CanAddScenario
};