const db = require('./dbConnect.js');
const user = require('../fakeData/testUser');

async function GetRoomInfo(roomId) {
  return await db.query(
    'SELECT * FROM rooms WHERE id=$1',
    [roomId]
  );
}

async function GetPlayersInRoom(roomId) {
  return await db.query(
    'SELECT * FROM rooms_users WHERE room_id = $1 ORDER BY user_id',
    [roomId]
  );
}

function MakeSureDeadlineHasNotPassed(roomQuery) {
  if (roomQuery.rows[0].turn_end < new Date()) {
    //++update player turn
    throw new Error('turn has already passed');
  }
}

function MakeSurePlayerHasEnoughChars(playerQuery, scenario) {
  playerQuery.rows.forEach(playerRow => {
    if (playerRow.user_id == user.id && playerRow.char_count < scenario.length) {
      throw new Error('player does not have enough characters left');
    };
  });
}

async function MakeSureItsNotTheLastTurn(roomId) {
  const scenariosQuery = await db.query(
    `SELECT *
        FROM scenarios
        WHERE room_id = $1`,
    [roomId]
  );
  if (scenariosQuery.rowCount >= 39)
    throw Error('Scenario limit reached! Must create ending');
}

function MakeSureItsNotFinished(roomQuery) {
  if (roomQuery.rows[0].finished)
    throw new Error('the story has already been ended');
}

function MakeSureItsPlayersTurn(roomQuery) {
  console.log(roomQuery.rows[0]);
  if (!roomQuery.rows[0].next_player_id || roomQuery.rows[0].next_player_id != user.id)
    throw new Error('its not the logged players turn');
}

function MakeSureRoomExists(roomQuery) {
  if (roomQuery.rowCount == 0)
    throw new Error('No room found with the given id');
}

async function UpdateRoomInfo(isEnd, isFull, roomId, playerQuery) {
  await db.query(
    `UPDATE rooms
      SET
        next_player_id = $1,
        turn_end = $4,
        finished = $3
      WHERE id = $2`,
    [
      isEnd || isFull ? null : GetNextPlayerId(playerQuery, isEnd),
      roomId,
      isEnd,
      isEnd || isFull ? null : new Date(Date.now() + 172800000)
    ]
  );
}

async function AddScenario(scenario, roomId) {
  const scenarioQuery = await db.query(
    'INSERT INTO scenarios(scenario, creator_id, room_id) VALUES ($1, $2, $3) RETURNING *',
    [scenario, user.id, roomId]
  );
  return scenarioQuery.rows[0].id;
}

async function BeginTransaction() {
  await db.query('BEGIN');
}

function GetNextPlayerId(playerQuery, isEnd) {
  let i = 0;
  playerQuery.rows.forEach((player, j) => {
    if (player.user_id != user.id)
      return;
    if (j == (playerQuery.rows.length - 1))
      return;
    i = j + 1;
  });
  const nextPlayerId = playerQuery.rows[i].user_id;
  if (isEnd)
    nextPlayerId = null;
  return nextPlayerId;
}

function Rollback() {
  db.query('ROLLBACK');
}

async function UpdateCharCount(scenario, roomId) {
  await db.query(
    'UPDATE rooms_users SET char_count = (char_count - $1 + 500) WHERE user_id = $2 AND room_id = $3',
    [scenario.length, user.id, roomId]
  );
}

async function GiveKeyToEachPlayer(roomId) {
  await db.query(
    `
        UPDATE users
        SET room_keys = room_keys + 1
        WHERE EXISTS(
          SELECT FROM rooms_users
          WHERE rooms_users.room_id = $1
          AND rooms_users.user_id = users.id
        );
        `,
    [roomId]
  );
}

async function Commit() {
  await db.query('COMMIT');
}

async function TryTransaction(Transaction, res) {

  try {
    await BeginTransaction();
    await Transaction();
    await Commit();
  }
  catch (error) {
    Rollback();
    console.error(error);
    res.status(400).send('Transaction failed: ' + error.message);
  }
}

module.exports = {
  GetRoomInfo,
  GetPlayersInRoom,
  MakeSureRoomExists,
  MakeSureDeadlineHasNotPassed,
  MakeSurePlayerHasEnoughChars,
  MakeSureItsNotTheLastTurn,
  MakeSureItsNotFinished,
  MakeSureItsPlayersTurn,
  UpdateRoomInfo,
  AddScenario,
  BeginTransaction,
  Rollback,
  UpdateCharCount,
  GiveKeyToEachPlayer,
  Commit,
  TryTransaction
};