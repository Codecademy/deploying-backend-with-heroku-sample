const db = require('./dbConnect.js');
const bcrypt = require('bcrypt');

//AUTH
async function CreateUser(name, email, password, pushToken) {

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  await db.query(
    'INSERT INTO users (name, email, password, expo_push_token) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, email, hash, pushToken]
  );

}

async function Login(email, password) {

  const query = await db.query(
    'SELECT * FROM users WHERE email = $1', [email]
  );

  if (!query.rows[0]) throw new Error('user with that email does not exist')
  if (!await bcrypt.compare(password, query.rows[0].password)) throw new Error('wrong password. hash is: ' + hash);

  return query.rows[0];

}

//GETTERS
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

function GetNextPlayerId(players, userId) {
  let i = 0;
  players.forEach((player, j) => {
    if (player.id != userId) return;
    if (j == (players.length - 1)) return;
    i = j + 1;
  });
  const nextPlayerId = players[i].id;
  return nextPlayerId;
}

async function GetLoggedUserInfo(id) {
  const query = await db.query('SELECT * FROM users WHERE id=' + id); //change to logged user when session is implemented

  if (!query.rows) throw new Error('Query returned nothing');
  if (query.rowCount < 1) throw new Error('Found no user with that id');
  if (query.rows.length > 2) throw new Error('Query returned multiple users');

  return query.rows[0];
}

async function GetPushToken(userId) {
  const query = await db.query('SELECT expo_push_token FROM users WHERE id = $1', [userId]);
  if (query.rowCount != 0) return query.rows[0].expo_push_token;
  else return null;
}

//CHECKS
function MakeSureDeadlineHasNotPassed(room) {
  if (room.turn_end < new Date()) {
    //++update player turn
    throw new Error('turn has already passed');
  }
}

function MakeSurePlayerHasEnoughChars(players, scenario, userId) {
  players.forEach(player => {
    if (player.user_id == userId && player.char_count < scenario.length) {
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

function MakeSureItsPlayersTurn(room, userId) {

  if (!room.next_player_id) {
    throw new Error(`there is no next player!`);
  }

  if (!room.next_player_id || room.next_player_id != userId) {
    throw new Error(`its not the logged players turn.
    poster id was ${userId},
    but its actually user with id ${room.nextPlayerId} who is next`);
  }

}

function MakeSureRoomExists(roomQuery) {
  if (roomQuery.rowCount == 0)
    throw new Error('No room found with the given id');
}

//SETTERS
async function UpdateRoomInfo(isEnd, roomId, nextPlayerId, turnEnd) {

  await db.query(
    `UPDATE rooms
      SET
        next_player_id = $1,
        turn_end = $4,
        finished = $3
      WHERE id = $2`,
    [
      nextPlayerId,
      roomId,
      isEnd,
      turnEnd
    ]
  );
}

async function AddScenario(scenario, roomId, userId) {
  const scenarioQuery = await db.query(
    'INSERT INTO scenarios(scenario, creator_id, room_id) VALUES ($1, $2, $3) RETURNING *',
    [scenario, userId, roomId]
  );
  return scenarioQuery.rows[0].id;
}

async function UpdateCharCount(scenario, roomId, userId) {
  await db.query(
    'UPDATE rooms_users SET char_count = (char_count - $1 + 500) WHERE user_id = $2 AND room_id = $3',
    [scenario.length, userId, roomId]
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

async function SetNextPlayerInRoom(roomId, userId) {
  await db.query(
    'UPDATE rooms SET next_player_id=$1 WHERE id=$2',
    [userId, roomId]
  );
}

async function UpdateRoomFullStatus(roomId) {
  await db.query(
    `UPDATE rooms
        SET "full"=((SELECT COUNT(*) FROM rooms_users WHERE rooms_users.room_id = rooms.id) >= 4)
        WHERE id = $1`,
    [roomId]
  );
}

async function ResetRoomTurnEnd(roomId) {
  await db.query(
    `UPDATE rooms SET turn_end=(NOW() + interval '2 day') WHERE id=$1`,
    [roomId]
  );
}

async function AddUserToRoom(roomId, userId) {
  await db.query(
    'INSERT INTO rooms_users (room_id, user_id) VALUES ($1, $2)',
    [roomId, userId]
  );
}

async function CreateNewRoom(title, description, scenario, creator_id) {
  const roomId = await AddRoom(title, description, creator_id);
  await AddUserToRoom(roomId, creator_id);
  await AddScenario(scenario, roomId, creator_id)
  return roomId;
}

async function AddRoom(title, description, creator_id) {
  const query = await db.query(
    'INSERT INTO rooms(title, description, creator_id) VALUES($1, $2, $3) RETURNING *',
    [title, description, creator_id]
  );
  return query.rows[0].id;
}

async function AddUserToRoom(roomId, user_id) {
  await db.query(
    'INSERT INTO rooms_users(room_id, user_id) VALUES($1, $2)',
    [roomId, user_id]
  );
}

async function RemoveKeyFromLoggedUser(userId) {
  await db.query(
    'UPDATE users SET room_keys = room_keys-1 WHERE id = $1',
    [userId]
  );
}

//TRANSACTIONS
async function BeginTransaction() {
  await db.query('BEGIN');
}

function Rollback() {
  db.query('ROLLBACK');
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

//EXPORT
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
  TryTransaction,
  RemoveKeyFromLoggedUser,
  CreateNewRoom,
  ResetRoomTurnEnd,
  UpdateRoomFullStatus,
  SetNextPlayerInRoom,
  AddUserToRoom,
  CreateUser,
  GetLoggedUserInfo,
  Login,
  GetPushToken,
  GetNextPlayerId
};