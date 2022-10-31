const express = require('express');
const scenarioRouter = express.Router();
const db = require('./dbConnect.js');
const user = require('../fakeData/testUser');

scenarioRouter.post('/', async (req, res) => {

  try {
    //CHECK QUERY PARAMS
    //check: room_id provided
    if (!req.query.room_id) throw new Error('No room_id provided');

    //checK: scenario text provided
    if (!req.query.text) throw new Error('No text provided');

    //check: scenario text is long enough
    if (req.query.text.length < 3) throw new Error('text must be at least 3 characters long');

    //start transaction
    await db.query('BEGIN');

    //CHECKS IN DB
    const playerQuery = await db.query( //might not be necessary, since we will query this table any way and can return the player
      'SELECT * FROM rooms_users WHERE room_id = $1 ORDER BY queue_number',
      [req.query.room_id]
    );

    //check: player has enough characters
    playerQuery.rows.forEach(playerRow => {
      if (playerRow.user_id == user.id && playerRow.char_count < req.query.text.length) {
        throw new Error('player does not have enough characters left')
      };
    })

    //check: its the players turn
    const roomQuery = await db.query(
      'SELECT * FROM rooms WHERE id=$1',
      [req.query.room_id]
    );
    if (roomQuery.rows[0].next_player_id != user.id) throw new Error('its not the logged players turn');

    //check: room is not finished
    if (roomQuery.rows[0].finished) throw new Error('the story has already been ended');

    //check: deadline has not passed
    if (roomQuery.rows[0].turn_end < new Date()) {
      //++update player turn
      throw new Error('turn has already passed');
    }

    //MAKE THE TRANSACTION
    //insert into scenarios
    const scenarioQuery = await db.query(
      'INSERT INTO scenarios(number_in_room, scenario, creator_id, room_id) VALUES ((SELECT MAX(number_in_room) FROM scenarios WHERE room_id = $3)+1, $1, $2, $3) RETURNING *',
      [req.query.text, user.id, req.query.room_id]
    );
    if (scenarioQuery.rows[0].number_in_room > 39) {
      throw Error('Scenario limit reached! Must create ending');
    }
    //update player turn
    //get the list of players for this room, then calc which one is after the player
    let i = 0;
    playerQuery.rows.forEach((player, j) => {
      if (player.user_id != user.id) return
      if (j == (playerQuery.rows.length-1)) return;
      i = j+1;
    })
    const nextPlayerId = playerQuery.rows[i].user_id;

    // let playerQueueNumber;
    // playerQuery.rows.forEach(playerRow => {
    //   if (playerRow.user_id == user.id) {
    //     playerQueueNumber = playerRow.queue_number;
    //   }
    // })
    // let nextPlayerId;
    // let nextPlayerNumber = playerQueueNumber;
    // let firstPlayerId;
    // let firstPlayerNumber = playerQueueNumber;
    // playerQuery.rows.forEach(row => {
    //   if (row.user_id == user.id) return;
    //   if (row.queue_number > playerQueueNumber && row.queue_number < nextPlayerNumber) {
    //     nextPlayerNumber = row.queue_number;
    //     nextPlayerId = row.user_id;
    //   }
    //   if (row.queue_number < firstPlayerNumber) {
    //     firstPlayerNumber = row.queue_number;
    //     firstPlayerId = row.user_id;
    //   }
    // })
    // if (nextPlayerId == user.id) {
    //   nextPlayerId = firstPlayerId;
    // }
    if (!nextPlayerId) throw new Error('next player ID is null');

    //set that player as the next ons
    await db.query('UPDATE rooms SET next_player_id = $1 WHERE id = $2', [nextPlayerId, req.query.room_id]);

    //update player character count
    await db.query(
      'UPDATE rooms_users SET char_count = (char_count - $1 + 500) WHERE user_id = $2 AND room_id = $3',
      [req.query.text.length, user.id, req.query.room_id]
    );

    //end transaction
    await db.query('COMMIT');
    res.status(200).send('new scenario added with id: ' + scenarioQuery.rows[0].id);
  }
  catch (error) {
    db.query('ROLLBACK');
    console.error('FAILED TO ADD NEW SCENARIO: ' + error.message);
    res.status(400).send('FAILED TO ADD NEW SCENARIO: ' + error.message)
  }

});


module.exports = scenarioRouter;