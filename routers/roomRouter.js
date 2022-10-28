const express = require('express');
const roomRouter = express.Router();
const db = require('./dbConnect.js')
const user = require('../fakeData/testUser');

roomRouter.get('/', async (req, res, next) => {
  const query = await db.query('SELECT * FROM rooms');
  res.json(query.rows)
});

roomRouter.get('/available', async (req, res, next) => {
  const query = await db.query(`
  SELECT
    rooms.id AS room_id,
    rooms.title AS title,
    rooms.description AS description,
    users.name AS user_name,
    (rooms.creator_id = rooms_users.user_id) AS creator
  FROM rooms
  JOIN rooms_users
  ON rooms.id = rooms_users.room_id
  JOIN users
  ON rooms_users.user_id = users.id
  WHERE
    rooms.full = false
    AND finished = false
    AND creator_id != 8
    AND users.id != 8
  
    
  -- also join with scenario table to count the number of scenarios
  -- salad hunt should not appear below! since the user is in it. How to remove that one? must filter rooms that has a corresponding row with our name in rooms_users
  `)
  console.log(query);
  res.json(query.rows)
});

roomRouter.post('/', async (req, res) => {

  //ERROR CHECKS
  if(!req.query.title){
    res.status(400).send('cant create room. Please provide a title');
    return;
  }
  if(req.query.title.length <= 3){
    res.status(400).send('cant create room. Title must be at least 3 chars long');
    return;
  }
  if(req.query.title.length > 20){
    res.status(400).send('cant create room. Title can me maximum 20 characters long');
    return;
  }
  if(!req.query.description){
    res.status(400).send('cant create room. Please provide a description');
    return;
  }
  if(req.query.description.length <= 3){
    res.status(400).send('cant create room. Title must be at least 3 chars long');
    return;
  }
  if(req.query.description.length > 200){
    res.status(400).send('cant create room. Description can be at max 200 characters');
    return;
  }
  if(!req.query.scenario){
    res.status(400).send('cant create room. Please provide a starting scenario');
    return;
  }
  if(req.query.scenario.length <= 19){
    res.status(400).send('cant create room. starting scenario must be at least 20 characters');
    return;
  }
  if(req.query.scenario.length > 500){
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
      'INSERT INTO rooms_users(room_id, user_id, queue_number) VALUES($1, $2, $3)',
      [newRoomId, user.id, 0]
    );
    await db.query(
      'INSERT INTO scenarios(number, text, creator_id, room_id) VALUES($1, $2, $3, $4)',
      [0, req.query.scenario, user.id, newRoomId]
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

module.exports = roomRouter;