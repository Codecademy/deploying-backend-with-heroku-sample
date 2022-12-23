const db = require('./dbConnect.js');
const bcrypt = require('bcrypt');
const { SendStrikeNotification, SendKickNotification, SendTurnNotification } = require('../notifications/notifications.js');
const { ValidateChars } = require('../middleware/validation');

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
async function GetActivePlayers(roomId) {
  const query = await db.query(
    `SELECT users.id, users.name, rooms_users.char_count, active, strikes
    FROM rooms_users
    JOIN users ON rooms_users.user_id = users.id
    WHERE rooms_users.room_id = $1
      AND rooms_users.active = true
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
async function GetNextPlayerId(roomId, currentPlayerId) {

  //get all the active players in order
  const players = await GetPlayersInRoom(roomId)

  //find the index of the player that is after the current one
  let i = 0;
  players.forEach((player, j) => {
    if (player.id != currentPlayerId) return;
    if (j == (players.length - 1)) return;
    i = j + 1;
  });

  //increment index until we find a player that is still active
  while (!players[i].active) {
    i++;
    if (i >= players.length) i = 0;
  }

  //return the id of the player
  const nextPlayerId = players[i].id;
  return nextPlayerId;
}
async function GetLoggedUserInfo(id) {
  if (!id) throw new Error('No user to query for user info');

  const query = await db.query('SELECT * FROM users WHERE id=$1', [id]);

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
async function GetUserChars(roomId, userId) {
  const query = await db.query(
    `SELECT char_count
    FROM rooms_users
    WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId]
  )
  if (query.rowCount != 0) return query.rows[0].char_count;
  else return null;
}
async function GetScenarioCount(roomId) {

  const q = await db.query(
    `SELECT COUNT(*) AS count
    FROM scenarios
    WHERE room_id = $1`,
    [roomId]
  );

  const { count } = q.rows[0];

  return count;

}

//CHECKS
function MakeSurePlayerHasEnoughChars(players, scenario, userId) {
  players.forEach(player => {
    if (player.id == userId && player.char_count < scenario.length) {
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
  const count = await GetScenarioCount(roomId);
  if (count >= 39) throw Error('Scenario limit reached! Must create ending');
}
async function MakeSureItsNotFinished(roomId) {
  const q = await db.query(`
    SELECT finished
    FROM rooms
    WHERE id = $1
  `, [roomId]);

  const finished = q.rows[0].finished;
  if (finished) throw new Error('Story has already been finished');
}
function MakeSureItsPlayersTurn(room, userId) {

  console.log('room is: ', room);

  if (!room.next_player_id) {
    throw new Error(`It's not the players turn to write!`);
  }

  if (!room.next_player_id || room.next_player_id != userId) {
    throw new Error(`its not the logged players turn. poster id was ${userId}, but its actually user with id ${room.next_player_id} who is next`);
  }

}
function MakeSureRoomExists(roomQuery) {
  if (roomQuery.rowCount == 0)
    throw new Error('No room found with the given id');
}
async function EmailExists(email) {

  const query = await db.query(`
  SELECT *
  FROM users
  WHERE email = $1
  `, [email]);

  return (query.rowCount > 0);

}
async function PlayerHasWrittenInRoom(roomID, userID) {

  const query = await db.query(`
  SELECT *
  FROM scenarios
  WHERE room_id = $1 AND creator_id = $2
  `, [roomID, userID]);

  return (query.rowCount > 0);

}
async function CanEnd(roomId) {

  const count = await GetScenarioCount(roomId);
  return (count >= 30); //this value should be grabbed from a balancing sheet

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
async function SetDeadlineIn30Min(roomId) {
  await db.query(
    `UPDATE rooms SET turn_end=(NOW() + interval '30 min') WHERE id=$1`,
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
async function AddUserToRoom(roomID, userID) {
  await db.query(
    'INSERT INTO rooms_users(room_id, user_id) VALUES($1, $2)',
    [roomID, userID]
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
    SET strikes = LEAST(3, strikes + 1)
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
async function Add2DaysToDeadline(room) {

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
async function CorrectRoomSearching(room, players, scenarios) {

  console.log('checking if room search needs to be corrected');

  const activePlayers = players.filter(player => player.active);
  const roomSetToSearching = (!room.full && !room.turn_end && !room.next_player_id);
  const isNewRoom = (scenarios.length < 4);

  //new room logic
  if (isNewRoom) {
    if (scenarios.length >= activePlayers.length) {
      if (roomSetToSearching) {
        return false;
      }
      else {
        console.log('new room, more scenarios than active players, and room is not yey searching - setting searching now!');
        await SetRoomSearching(room.id);
        return true;
      }
    }
    else {
      if (!room.turn_end && !room.next_player_id) {
        console.log(`
        New room,
        more or equal amount of active players to scenarios,
        turn end and next player id is null,
        -> setting full to false, turn end in 2 days, and next player id to something
        `);
        await db.query(`
        UPDATE rooms
        SET
          "full" = false,
          turn_end = NOW() + Interval '2 day',
          next_player_id = $1
        WHERE id = $2
        `, [activePlayers[activePlayers.length - 1].id, room.id]);
        return true;
      }
      else {
        return false;
      }
    }
  }

  //old room logic
  if (activePlayers.length == 4) {
    if (room.full && room.next_player_id && room.turn_end) return false;
    else {
      await SetRoomFull(room, players, scenarios);
      return true;
    }
  }
  else {
    if (!room.full && !room.turn_end && !room.next_player_id) return false;
    else {
      await SetRoomSearching(room.id);
      return true;
    }
  }

}
async function CheckRoomDeadline(room) {

  //checking if deadline has been reached
  const q = await db.query(`
    SELECT (turn_end < NOW()) AS passed
    FROM rooms
    WHERE id = $1;
  `, [room.id]);
  const { passed } = q.rows[0];

  //handling and returning true if it was
  if (passed) await HandleDeadlinePassed(room);
  return passed;

}
async function HandleDeadlinePassed(room) {

  console.log('deadline passed for room with id: ', room.id);

  const playerThatMissedID = room.next_player_id;

  //kick if new player
  const isNewPlayer = !(await PlayerHasWrittenInRoom(room.id, playerThatMissedID));
  if (isNewPlayer) {
    console.log(`Kicking new player ${playerThatMissedID} from room ${room.id}`);
    await DeactivatePlayer(room.id, playerThatMissedID);
    await SetRoomSearching(room.id);
    return;
  }

  //add strike
  const strikes = await AddStrike(room.id, playerThatMissedID);

  //get push token
  const pushToken = await GetPushToken(playerThatMissedID);

  //kick if 3 strikes
  if (strikes >= 3) {
    console.log(`Kicking player ${playerThatMissedID} from room ${room.id}`);
    await DeactivatePlayer(room.id, playerThatMissedID);
    await SetRoomSearching(room.id);
    SendKickNotification(pushToken, room.title);
    return;
  }

  //pass the turn
  await PassTurn(room, playerThatMissedID);
  SendStrikeNotification(pushToken, room.title, strikes, room.id, playerThatMissedID);
}
async function CheckRoomInfo(room, players, scenarios) {

  console.log('checking the room info');

  //this function is a bit bloated. Wierd that it is separated in 2.
  //Should probably just check everything here. maybe...

  //this function returns TRUE if a correction was made to who is the next player

  //check to see if the room has space and if so set it searching for new players
  const roomSearchingCorrected = await CorrectRoomSearching(room, players, scenarios);
  if (roomSearchingCorrected) {
    room = await GetRoomInfo(room.id);
  }
  const turnPassed = await CheckRoomDeadline(room);
  return (turnPassed || roomSearchingCorrected);

}
async function PassTurn(room, currentPlayerId) {

  if (!room.full) {
    SetRoomSearching(room.id);
    return;
  }

  // const players = await GetPlayersInRoom(room.id);
  const nextPlayerId = await GetNextPlayerId(room.id, currentPlayerId);
  await SetNextPlayerInRoom(room.id, nextPlayerId)
  await SetDeadlineIn2Days(room.id);
  const nextPlayer = await GetLoggedUserInfo(nextPlayerId);
  SendTurnNotification(nextPlayer.expo_push_token, room.id, room.title, nextPlayerId);
  console.log('turn passed :)');

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
async function AddPasswordResetCode(code, userEmail) {

  await db.query(`
  UPDATE users
  SET
    password_reset_code = $1,
    password_reset_timeout = NOW() + Interval '30 min'
  WHERE email = $2;
  `, [code, userEmail]);

  return;

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
  SetDeadlineIn30Min,
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
  EndStory,
  GetUserChars,
  HandleDeadlinePassed,
  CheckRoomDeadline,
  EmailExists,
  AddPasswordResetCode,
  CanEnd
};