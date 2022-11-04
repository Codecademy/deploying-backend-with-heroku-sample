const express = require('express');
const roomRouter = express.Router();
const db = require('./dbConnect.js');
const dbFunctions = require('./dbFunctions');
const user = require('../fakeData/testUser');

//GETTER FUNCTIONS
const GetRoomData = async (req, res, next) => {

  try {
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

  req.roomQuery = (
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
      AND NOT EXISTS(SELECT * FROM rooms_users WHERE user_id = $1 AND room_id = rooms.id)
    GROUP BY (rooms_users.user_id, rooms.id, users.name)
    ORDER BY id;`
  );
  req.roomQueryParams = [user.id];
  next();

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
    WHERE EXISTS (SELECT * FROM rooms_users WHERE room_id = rooms.id AND user_id = $1);`
  );
  req.roomQueryParams = [user.id];
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
    await dbFunctions.RemoveKeyFromLoggedUser();
    const newRoomId = await dbFunctions.CreateNewRoom(title, description, scenario, user.id);
    req.responseMessage = {success: true, message: 'new room added!', roomId: newRoomId};
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
    await dbFunctions.AddUserToRoom(roomId, user.id);
    await dbFunctions.ResetRoomTurnEnd(roomId);
    await dbFunctions.UpdateRoomFullStatus(roomId);
    await dbFunctions.SetNextPlayerInRoom(roomId, user.id);

    //response
    req.responseMessage = 'Successfully joined the room!';
  }

  next();
}

//MOUNT ROUTes
roomRouter.get('/data/:id', GetRoomData);
roomRouter.get('/available', AttachAvailableRoomsQuery, RetrieveRooms);
roomRouter.get('/user', AttachUserRoomsQuery, RetrieveRooms);
roomRouter.get('/archive', AttachArchiveQuery, RetrieveRooms);
roomRouter.post('/', AttachCreateRoomTransaction, dbFunctions.TryTransaction);
roomRouter.post('/join', AttachJoinRoomTransaction, dbFunctions.TryTransaction);

//EXPORT
module.exports = roomRouter;

//FUNCTIONS
async function RetrieveRooms(req, res) {

  try {
    const query = await db.query(req.roomQuery, req.roomQueryParams);
    let rooms = [];
    query.rows.forEach(room => {

      let roomAlreadyInArray = false;

      rooms.forEach(roomToCheck => {
        if (roomToCheck.id == room.id) {
          roomAlreadyInArray = true;
          if (room.user == room.creator) return;
          roomToCheck.writers.push(room.user);
        }
      })

      if (!roomAlreadyInArray) {
        if (room.creator != room.user) {
          room.writers = [room.user];
        }
        else room.writers = [];
        delete room.user;
        rooms.push(room);
      }
    });
    res.status(200).json(rooms);
  }
  catch (error) {
    res.status(400).send('unable to get your rooms: ' + error.message);
  }

}