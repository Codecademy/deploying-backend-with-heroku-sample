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
      case when rooms.next_player_id = $1 then 'TRUE' else 'FALSE' end as users_turn
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
const AttachAddRoomTransaction = async (req, res, next) => {

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
    await RemoveKeyFromLoggedUser();
    const newRoomId = await CreateNewRoom(req.query.title, req.query.description, req.query.scenario, user.id);
    req.responseMessage = 'new room added with ID ' + newRoomId;
  }

  next();
}
const AttachJoinRoomTransaction = async (req, res, next) => {

  req.Transaction = async () => {
    if (!req.query.room_id) throw new Error('Please provide a room_id!');

    //make sure room is not full or finished
    const roomQuery = await db.query('SELECT * FROM rooms WHERE id=$1', [req.query.room_id]);
    if (roomQuery.rows.length == 0) throw new Error('There is no room with that id');
    if (roomQuery.rows[0].full) throw new Error('Room is full');
    if (roomQuery.rows[0].finished) throw new Error('Story has already been finished');

    //add players to rooms_users
    const playerQuery = await db.query(
      'SELECT * FROM rooms_users WHERE room_id = $1',
      [req.query.room_id]
    );
    await db.query(
      'INSERT INTO rooms_users (room_id, user_id) VALUES ($1, $2)',
      [req.query.room_id, user.id]
    );

    //alter the rooms table
    //add a turn_end timestamp to room
    await db.query(
      `UPDATE rooms SET turn_end=(NOW() + interval '2 day') WHERE id=$1`, //deadline 2 days from now
      [req.query.room_id]
    );

    //make room full if full
    if (playerQuery.rows.length == 3) {
      await db.query(
        'UPDATE rooms SET "full"=true WHERE id=$1',
        [req.query.room_id]
      );
    }

    //set next player
    await db.query(
      'UPDATE rooms SET next_player_id=$1 WHERE id=$2',
      [user.id, req.query.room_id]
    );

    req.responseMessage = 'Successfully joined the room!';
  }

  next();
}

//MOUNT ROUTes
roomRouter.get('/data/:id', GetRoomData);
roomRouter.get('/available', AttachAvailableRoomsQuery, RetrieveRooms);
roomRouter.get('/user', AttachUserRoomsQuery, RetrieveRooms);
roomRouter.get('/archive', AttachArchiveQuery, RetrieveRooms);
roomRouter.post('/', AttachAddRoomTransaction, dbFunctions.TryTransaction);
roomRouter.post('/join', AttachJoinRoomTransaction, dbFunctions.TryTransaction);

//EXPORT
module.exports = roomRouter;

async function CreateNewRoom(title, description, scenario, creator_id) {
  const roomId = await AddRoom(title, description, creator_id);
  await AddUserToRoom(roomId, creator_id);
  await dbFunctions.AddScenario(scenario, roomId)
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

async function RemoveKeyFromLoggedUser() {
  await db.query(
    'UPDATE users SET room_keys = room_keys-1 WHERE id = $1',
    [user.id]
  );
}

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