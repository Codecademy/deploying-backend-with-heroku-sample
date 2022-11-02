const db = require('./dbConnect.js');
const user = require('../fakeData/testUser');

async function GetRoomInfo(roomId) {
  const roomQuery = await db.query(
    'SELECT * FROM rooms WHERE id=$1',
    [roomId]
  );

  MakeSureRoomExists(roomQuery);

  return roomQuery.rows[0];
}

async function GetPlayersInRoom(roomId) {
  const query = await db.query(
    `SELECT users.id, users.name, rooms_users.char_count, active
    FROM rooms_users
    JOIN users ON rooms_users.user_id = users.id
    WHERE rooms_users.room_id = $1
    ORDER BY rooms_users.id`,
    [roomId]
  );

  return query.rows;
}

const GetScenariosInRoom = async (roomId) => {

  const scenarioQuery = await db.query(
    `SELECT scenario, creator_id
    FROM scenarios
    WHERE room_id = $1
    ORDER BY id`,
    [roomId]
  );

  return scenarioQuery.rows;

}

function MakeSureDeadlineHasNotPassed(room) {
  if (room.turn_end < new Date()) {
    //++update player turn
    throw new Error('turn has already passed');
  }
}

function MakeSurePlayerHasEnoughChars(players, scenario) {
  players.forEach(player => {
    if (player.user_id == user.id && player.char_count < scenario.length) {
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

function MakeSureItsNotFinished(room) {
  if (room.finished)
    throw new Error('the story has already been ended');
}

function MakeSureItsPlayersTurn(room) {
  if (!room.next_player_id || room.next_player_id != user.id)
    throw new Error('its not the logged players turn');
}

function MakeSureRoomExists(roomQuery) {
  if (roomQuery.rowCount == 0)
    throw new Error('No room found with the given id');
}

async function UpdateRoomInfo(isEnd, isFull, roomId, players) {
  await db.query(
    `UPDATE rooms
      SET
        next_player_id = $1,
        turn_end = $4,
        finished = $3
      WHERE id = $2`,
    [
      isEnd || isFull ? null : GetNextPlayerId(players, isEnd),
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

function GetNextPlayerId(players, isEnd) {
  let i = 0;
  players.forEach((player, j) => {
    if (player.user_id != user.id)
      return;
    if (j == (players.length - 1))
      return;
    i = j + 1;
  });
  const nextPlayerId = players[i].user_id;
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

async function TryTransaction(req, res, next) {

  try {
    await BeginTransaction();
    await req.Transaction(); //attach the query function you want to user
    await Commit();
    res.send(req.responseMessage); //attach a response message to send on a successfull transaction
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
  GetScenariosInRoom,
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