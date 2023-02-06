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

module.exports = {
  CanAddNode,
};