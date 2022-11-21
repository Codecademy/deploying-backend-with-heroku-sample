const db = require('./dbConnect.js');
const bcrypt = require('bcrypt');
const { SendStrikeNotification, SendKickNotification, SendTurnNotification } = require('../notifications/notifications.js');

//AUTH
async function CreateUser(name, email, password, pushToken) {

  const checkEmail = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (checkEmail.rowCount > 0) throw new Error('email already in use');

  const checkName = await db.query('SELECT * FROM users WHERE name = $1', [name]);
  if (checkName.rowCount > 0) throw new Error('display name already taken');

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
    `SELECT users.id, users.name, rooms_users.char_count, active, strikes
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

function GetNextPlayerId(players, currentPlayerId) {
  let i = 0;
  players.forEach((player, j) => {
    if (player.id != currentPlayerId) return;
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
function MakeSurePlayerHasEnoughChars(players, scenario, userId) {
  players.forEach(player => {
    if (player.user_id == userId && player.char_count < scenario.length) {
      throw new Error('player does not have enough characters left');
    };
  });
}

function MakeSurePlayerIsActive(players, userId) {
  let playerFound = false;
  players.forEach(player => {
    if (player.id == userId) {
      playerFound = true;
      if (!player.active) throw new Error('player has been kicked');
    };
  });

  if (!playerFound) throw new Error('player is not in this room');
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
    throw new Error(`its not the logged players turn. poster id was ${userId}, but its actually user with id ${room.next_player_id} who is next`);
  }

}

function MakeSureRoomExists(roomQuery) {
  if (roomQuery.rowCount == 0)
    throw new Error('No room found with the given id');
}

//SETTERS
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

async function SetDeadlineIn2Days(roomId) {
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

async function AddStrike(roomId, userId) {

  const query = await db.query(
    `UPDATE rooms_users
    SET strikes = strikes + 1
    WHERE room_id = $1 AND user_id = $2
    RETURNING strikes`,
    [roomId, userId]
  );

  return query.rows[0].strikes;

}

async function DeactivatePlayer(roomId, userId) {

  await db.query(`
  UPDATE rooms_users
  SET active = false
  WHERE room_id = $1 AND user_id = $2
  `, [roomId, userId]);

}

async function SetRoomSearching(roomId) {

  await db.query(`
  UPDATE rooms
  SET "full"=false, next_player_id=null, turn_end=null
  WHERE id=$1
  `, [roomId]);

}

async function Add2DaysToDeadline(room){

  let newTurnEnd;
  if (room.turn_end) newTurnEnd = new Date(new Date(room.turn_end).getTime() + 172800000);
  else newTurnEnd = new Date(new Date().getTime() + 172800000);

  await db.query(`
  UPDATE rooms
  SET turn_end = $2
  WHERE id = $1
  `, [room.id, newTurnEnd]);

}

async function SetRoomFull(room, players, scenarios) {

  if (room.full && room.next_player_id && room.turn_end) return;

  const nextPlayerId = (
    room.next_player_id ?
      room.next_player_id :
      GetNextPlayerId(players, scenarios[scenarios.length - 1].creator_id)
  );

  await db.query(`
  UPDATE rooms
  SET
    "full" = true,
    next_player_id = $1
  WHERE id = $2
  `, [nextPlayerId, room.id]
  );

  const mustUpdateTurnEnd = (!room.turn_end || room.turn_end < new Date());
  if (mustUpdateTurnEnd) await Add2DaysToDeadline(room);

}

async function CheckRoomSearching(room, players, scenarios) {

  const activePlayers = players.filter(player => player.active);

  if (activePlayers.length == 4) {
    await SetRoomFull(room, players, scenarios);
    return false;
  }
  else {
    await SetRoomSearching(room.id);
    return true;
  }

}

async function CheckRoomDeadline(room) {

  //Checking if the room deadline has been reached, and passing turn if it has
  //returning TRUE if the turn was passed

  const { turn_end, title, next_player_id: currentPlayerId } = room;

  if (!turn_end) return false;
  if (!currentPlayerId) return false;
  if (turn_end > new Date()) return false;

  const strikes = await AddStrike(room.id, currentPlayerId);
  const currentPlayer = await GetLoggedUserInfo(currentPlayerId);
  const pushToken = currentPlayer.expo_push_token;

  if (strikes >= 3) {
    await DeactivatePlayer(room.id, currentPlayerId);
    if (!roomSearching) await SetRoomSearching(room);
    SendKickNotification(pushToken, title);
  }
  else {
    await PassTurn(room, currentPlayerId);
    SendStrikeNotification(pushToken, title, strikes, room.id, currentPlayerId);
  }

  return true;

}

async function CheckRoomInfo(room, players, scenarios) {

  //this function returns TRUE if a correction was made to who is the next player

  //check to see if the room has space and if so set it searching for new players
  const roomSearching = await CheckRoomSearching(room, players, scenarios);
  if (roomSearching) return true;

  //check deadline, if it has been reached we should move to the next player
  const turnPassed = await CheckRoomDeadline(room);
  return turnPassed;

}

async function PassTurn(room, currentPlayerId) {

  if (room.full) {
    const players = await GetPlayersInRoom(room.id);
    const nextPlayerId = await GetNextPlayerId(players, currentPlayerId);
    await SetNextPlayerInRoom(room.id, nextPlayerId)

    const deadlineMet = room.turn_end > new Date();
    if (deadlineMet) await SetDeadlineIn2Days(room.id);
    else await Add2DaysToDeadline(room);

    //notify the next player
    const nextPlayer = await GetLoggedUserInfo(nextPlayerId);
    SendTurnNotification(nextPlayer.expo_push_token, room.id, room.title, nextPlayerId);
  }
  else {
    await db.query(`
    UPDATE rooms
    SET
      turn_end = null,
      next_player_id = null
    WHERE id = $1
    `, [room.id]
    );
  }


}

async function EndStory(roomId) {
  GiveKeyToEachPlayer(roomId);
  db.query(
    `UPDATE rooms
    SET
      turn_end = null,
      next_player_id = null,
      finished = true
    WHERE id = $1`,
    [roomId]
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
    res.status(400).send({ ok: false, message: error.message });
  }

}

//EXPORT
module.exports = {
  GetRoomInfo,
  GetPlayersInRoom,
  GetScenariosInRoom,
  MakeSureRoomExists,
  MakeSurePlayerHasEnoughChars,
  MakeSureItsNotTheLastTurn,
  MakeSureItsNotFinished,
  MakeSureItsPlayersTurn,
  AddScenario,
  BeginTransaction,
  Rollback,
  UpdateCharCount,
  GiveKeyToEachPlayer,
  Commit,
  TryTransaction,
  RemoveKeyFromLoggedUser,
  CreateNewRoom,
  SetDeadlineIn2Days,
  UpdateRoomFullStatus,
  SetNextPlayerInRoom,
  AddUserToRoom,
  CreateUser,
  GetLoggedUserInfo,
  Login,
  GetPushToken,
  GetNextPlayerId,
  CheckRoomInfo,
  MakeSurePlayerIsActive,
  PassTurn,
  EndStory
};