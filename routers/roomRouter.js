const express = require('express');
const roomRouter = express.Router();
const db = require('../database/dbConnect.js');
const dbFunctions = require('../database/dbFunctions');
const { isAuth } = require('../middleware/authentication');

//GETTER FUNCTIONS
const GetRoomData = async (req, res, next) => {

  try {
    await dbFunctions.CheckDeadline(req.params.id)
    const room = await dbFunctions.GetRoomInfo(req.params.id)
    room.players = await dbFunctions.GetPlayersInRoom(req.params.id);
    room.scenarios = await dbFunctions.GetScenariosInRoom(req.params.id);
    res.status(200).send(room);
  }
  catch (error) {
    console.error(error);
    res.status(400).send('Failed to get room: ' + error.message);
  }

}
const AttachAvailableRoomsQuery = async (req, res, next) => {

  try {

    const availableRooms = await GetRoomsDb(
      `SELECT
        rooms.id,
        rooms.title AS title,
        rooms.description AS description,
        users.name AS user,
        (SELECT name FROM users WHERE id = rooms.creator_id) AS creator,
        COUNT(scenarios.id) AS scenario_count
      FROM rooms
      JOIN rooms_users ON rooms.id = rooms_users.room_id
      JOIN users ON rooms_users.user_id = users.id
      JOIN scenarios ON scenarios.room_id = rooms.id
      WHERE
        rooms.full = false
        AND rooms.finished = false
        AND rooms.next_player_id IS NULL
        AND NOT EXISTS(SELECT * FROM rooms_users WHERE user_id = $1 AND room_id = rooms.id)
      GROUP BY (rooms_users.user_id, rooms.id, users.name)
      ORDER BY id`,
      [req.userId]
    )

    const newRooms = availableRooms.filter(room =>
      (room.scenario_count < 4)
    );
    const oldRooms = availableRooms.filter(room => room.scenario_count >= 4);

    if (newRooms.length > 3) newRooms.splice(3, newRooms.length - 3);
    if (oldRooms.length > 3) oldRooms.splice(3, oldRooms.length - 3);

    res.status(200).json({ new: newRooms, old: oldRooms });

  } catch (error) {

    res.status(400).send('unable to get available rooms: ' + error.message);

  }

  //old code
  // req.roomQuery = (
  //   `SELECT
  //     rooms.id,
  //     rooms.title AS title,
  //     rooms.description AS description,
  //     users.name AS user,
  //     (SELECT name FROM users WHERE id = rooms.creator_id) AS creator,
  //     COUNT(scenarios.id) AS scenario_count
  //   FROM rooms
  //   JOIN rooms_users ON rooms.id = rooms_users.room_id
  //   JOIN users ON rooms_users.user_id = users.id
  //   JOIN scenarios ON scenarios.room_id = rooms.id
  //   WHERE
  //     rooms.full = false
  //     AND rooms.finished = false
  //     AND NOT EXISTS(SELECT * FROM rooms_users WHERE user_id = $1 AND room_id = rooms.id)
  //   GROUP BY (rooms_users.user_id, rooms.id, users.name)
  //   ORDER BY id;`
  // );
  // /*
  // this should be limited to 3 new rooms and 3 old rooms!
  // cannot do double queries here
  // can do in many ways
  // seems reasonable that the backend should return new and old in separate objects
  // this means we also have to change the front-end to accomodate for this
  // alternatively we split into 2
  // but no, right now we will always query together.
  // However - we COULD make 2 queries here
  // Or take the array of retrieved rooms and filter them into 2 array
  // and limit that array
  // but idk, kina like the double query idea.
  // seems we might have to custom make this function since it will be a special case
  // Alternatively we could 
  // */
  // req.roomQueryParams = [req.userId];
  // next();

}
const AttachUserRoomsQuery = async (req, res, next) => {

  req.roomQuery = (
    `SELECT
      rooms.id,
      title,
      description,
      finished,
      (SELECT name FROM users WHERE id = rooms.creator_id) AS creator,
      (SELECT name FROM users WHERE id = rooms_users.user_id) AS user,
      (SELECT COUNT(*) FROM scenarios WHERE room_id = rooms.id) AS scenario_count,
      case when rooms.next_player_id = $1 then true else false end as users_turn
    FROM rooms
    JOIN rooms_users ON rooms_users.room_id = rooms.id
    WHERE EXISTS (
      SELECT * FROM rooms_users
      WHERE room_id = rooms.id
      AND user_id = $1
    )
    AND rooms_users.active = true;`
  );
  req.roomQueryParams = [req.userId];
  next();

}
const AttachArchiveQuery = async (req, res, next) => {

  req.roomQuery = (
    `SELECT
      rooms.id,
      title,
      description,
      (SELECT name FROM users WHERE id = rooms.creator_id) AS creator,
      (SELECT name FROM users WHERE id = rooms_users.user_id) AS user,
      (SELECT COUNT(*) FROM scenarios WHERE room_id = rooms.id) AS scenario_count
    FROM rooms
    JOIN rooms_users ON rooms_users.room_id = rooms.id
    WHERE rooms.finished = true`
  );
  req.roomQueryParams = [];
  next();

}

//POST TRANSACTION FUNCTIONS
const AttachCreateRoomTransaction = async (req, res, next) => {

  req.Transaction = async () => {

    const title = req.query.title;
    const description = req.query.description;
    const scenario = req.query.scenario;

    //ERROR CHECKS
    if (!title) throw new Error('Please provide a title');
    if (title.length <= 3) throw new Error('Title must be at least 3 chars long');
    if (title.length > 50) throw new Error('Title can me maximum 50 characters long');

    if (!description) throw new Error('Please provide a description');
    if (description.length <= 3) throw new Error('Description must be at least 3 chars long');
    if (description.length > 200) throw new Error('Description can be at max 200 characters');

    if (!scenario) throw new Error('Please provide a starting scenario');
    if (scenario.length <= 19) throw new Error('Starting scenario must be at least 20 characters');
    if (scenario.length > 500) throw new Error('Starting scenario can be at max 500 characters');

    //TRY ADD TO DATABASE
    await dbFunctions.RemoveKeyFromLoggedUser(req.userId);
    const newRoomId = await dbFunctions.CreateNewRoom(title, description, scenario, req.userId);
    req.responseMessage = { success: true, message: 'new room added!', roomId: newRoomId };
  }

  next();
}
const AttachJoinRoomTransaction = async (req, res, next) => {

  req.Transaction = async () => {

    const roomId = req.query.room_id;
    if (!roomId) throw new Error('Please provide a room_id!');

    //Checks
    const room = await dbFunctions.GetRoomInfo(roomId);
    if (room.full) throw new Error('Room is full');
    if (room.finished) throw new Error('Story has already been finished');

    //update
    await dbFunctions.AddUserToRoom(roomId, req.userId);
    await dbFunctions.ResetRoomTurnEnd(roomId);
    await dbFunctions.UpdateRoomFullStatus(roomId);
    await dbFunctions.SetNextPlayerInRoom(roomId, req.userId);

    //response
    req.responseMessage = 'Successfully joined the room!';
  }

  next();
}

//MOUNT ROUTes
roomRouter.use(isAuth);

roomRouter.get('/data/:id', GetRoomData);
roomRouter.get('/available', AttachAvailableRoomsQuery, RetrieveRooms);
roomRouter.get('/user', AttachUserRoomsQuery, RetrieveRooms);
roomRouter.get('/archive', AttachArchiveQuery, RetrieveRooms);

roomRouter.post('/', AttachCreateRoomTransaction, dbFunctions.TryTransaction);
roomRouter.post('/join', AttachJoinRoomTransaction, dbFunctions.TryTransaction);

//EXPORT
module.exports = roomRouter;

//MIDDLEWARE
async function RetrieveRooms(req, res) {

  try {
    const query = await db.query(req.roomQuery, req.roomQueryParams);
    const rooms = ParseRoomsForFrontend(query.rows);
    res.status(200).json(rooms);
  }
  catch (error) {
    res.status(400).send('unable to get your rooms: ' + error.message);
  }

}

async function GetRoomsDb(roomQuery, roomQueryParams) {

  const query = await db.query(roomQuery, roomQueryParams);
  const rooms = ParseRoomsForFrontend(query.rows);
  return rooms;

}

function ParseRoomsForFrontend(unparsedRooms) {
  //I have like... no idea what this function does
  //I think it organizes the room so that users, writers, creators, players etc 
  //are put in the way expected by frontend
  let rooms = [];
  unparsedRooms.forEach(room => {

    let roomAlreadyInArray = false;

    rooms.forEach(roomToCheck => {
      if (roomToCheck.id == room.id) {
        roomAlreadyInArray = true;
        if (room.user == room.creator)
          return;
        roomToCheck.writers.push(room.user);
      }
    });

    if (!roomAlreadyInArray) {
      if (room.creator != room.user) {
        room.writers = [room.user];
      }
      else
        room.writers = [];
      delete room.user;
      rooms.push(room);
    }
  });
  return rooms;
}
