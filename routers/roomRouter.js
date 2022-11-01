const express = require('express');
const roomRouter = express.Router();
const db = require('./dbConnect.js')
const user = require('../fakeData/testUser');

//GETTERS

roomRouter.get('/:id', async (req, res, next) => {

  try {
    
    const roomQuery = await db.query(
      `SELECT title, description, creator_id, next_player_id, turn_end, finished
      FROM rooms
      WHERE id = $1`,
      [req.params.id]
    );

    if(roomQuery.rowCount == 0) throw new Error('Could not find a room with the provided ID');

    const playerQuery = await db.query(
      `SELECT users.id, users.name, rooms_users.char_count
      FROM rooms_users
      JOIN users ON rooms_users.user_id = users.id
      WHERE rooms_users.room_id = $1
      ORDER BY rooms_users.id`,
      [req.params.id]
    );

    const scenarioQuery = await db.query(
      `SELECT scenario, creator_id
      FROM scenarios
      WHERE room_id = $1
      ORDER BY id`,
      [req.params.id]
    );

    const room = roomQuery.rows[0];
    room.players = playerQuery.rows;
    room.scenarios = scenarioQuery.rows;

    res.status(200).send(room);

  } 
  catch (error) {
    
  }

});

roomRouter.get('/available', async (req, res, next) => {

  RetrieveRooms(
    `
    SELECT
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
    ORDER BY id;
    `,
    [user.id],
    res
  );

});

roomRouter.get('/user', async (req, res, next) => {

  RetrieveRooms(
    `
    SELECT
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
    WHERE EXISTS (SELECT * FROM rooms_users WHERE room_id = rooms.id AND user_id = $1);
    `,
    [user.id],
    res
  );

});

roomRouter.get('/archive', async (req, res, next) => {

  await RetrieveRooms(
    `
    SELECT
      rooms.id,
      title,
      description,
      (SELECT name FROM users WHERE id = rooms.creator_id) AS creator,
      (SELECT name FROM users WHERE id = rooms_users.user_id) AS user,
      (SELECT COUNT(*) FROM scenarios WHERE room_id = rooms.id) AS scenario_count
    FROM rooms
    JOIN rooms_users ON rooms_users.room_id = rooms.id
    WHERE rooms.finished = true
    `,
    [],
    res
  );

});

//SETTERS

roomRouter.post('/', async (req, res) => {

  //ERROR CHECKS
  if (!req.query.title) {
    res.status(400).send('cant create room. Please provide a title');
    return;
  }
  if (req.query.title.length <= 3) {
    res.status(400).send('cant create room. Title must be at least 3 chars long');
    return;
  }
  if (req.query.title.length > 50) {
    res.status(400).send('cant create room. Title can me maximum 50 characters long');
    return;
  }
  if (!req.query.description) {
    res.status(400).send('cant create room. Please provide a description');
    return;
  }
  if (req.query.description.length <= 3) {
    res.status(400).send('cant create room. Title must be at least 3 chars long');
    return;
  }
  if (req.query.description.length > 200) {
    res.status(400).send('cant create room. Description can be at max 200 characters');
    return;
  }
  if (!req.query.scenario) {
    res.status(400).send('cant create room. Please provide a starting scenario');
    return;
  }
  if (req.query.scenario.length <= 19) {
    res.status(400).send('cant create room. starting scenario must be at least 20 characters');
    return;
  }
  if (req.query.scenario.length > 500) {
    res.status(400).send('cant create room. Starting scenario can be at max 500 characters');
    return;
  }

  //TRY ADD TO DATABASE
  try {
    await db.query('BEGIN');
    await db.query(
      'UPDATE users SET room_keys = room_keys-1 WHERE id = $1',
      [user.id]
    );
    const newRoomRes = await db.query(
      'INSERT INTO rooms(title, description, creator_id) VALUES($1, $2, $3) RETURNING *',
      [req.query.title, req.query.description, user.id]
    );
    const newRoomId = newRoomRes.rows[0].id;
    await db.query(
      'INSERT INTO rooms_users(room_id, user_id) VALUES($1, $2)',
      [newRoomId, user.id]
    );
    await db.query(
      'INSERT INTO scenarios(scenario, creator_id, room_id) VALUES($1, $2, $3)',
      [req.query.scenario, user.id, newRoomId]
    );
    await db.query('COMMIT');
    res.status(200).send('new room added with ID ' + newRoomId);
  }
  catch (e) {
    db.query('ROLLBACK');
    console.error('FAILED TO ADD NEW ROOM: ' + e.message);
    res.status(400).send('FAILED TO ADD NEW ROOM: ' + e.message)
  }

});

roomRouter.post('/join', async (req, res) => {

  try {

    if (!req.query.room_id) throw new Error('Please provide a room_id!');

    await db.query('BEGIN');

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

    //commit
    await db.query('COMMIT');
    res.status(200).send('Successfully joined the room!');
  }
  catch (e) {
    db.query('ROLLBACK');
    console.error('FAILED TO JOIN ROOM: ' + e.message);
    res.status(400).send('FAILED TO JOIN ROOM: ' + e.message)
  }

});

//EXPORT

module.exports = roomRouter;

//FUNCTIONS

async function RetrieveRooms(queryText, queryParams, res) {

  try {
    const query = await db.query(queryText, queryParams);
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