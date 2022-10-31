const express = require('express');
const scenarioRouter = express.Router();
const db = require('./dbConnect.js');
const user = require('../fakeData/testUser');

scenarioRouter.post('/', async (req, res) => {

  const roomId = req.query.room_id;
  const scenario = req.query.text;
  const isEnd = (req.query.end);

  console.log('end is: ', isEnd);

  try {

    //CHECKS
    if (!roomId) throw new Error('No room_id provided');
    if (!scenario) throw new Error('No text provided');
    if (scenario.length < 3) throw new Error('text must be at least 3 characters long');

    const playerQuery = await db.query(
      'SELECT * FROM rooms_users WHERE room_id = $1 ORDER BY queue_number',
      [roomId]
    );

    //check: player has enough characters
    playerQuery.rows.forEach(playerRow => {
      if (playerRow.user_id == user.id && playerRow.char_count < scenario.length) {
        throw new Error('player does not have enough characters left')
      };
    })

    //check: its the players turn
    const roomQuery = await db.query(
      'SELECT * FROM rooms WHERE id=$1',
      [roomId]
    );
    if (roomQuery.rows[0].next_player_id != user.id) throw new Error('its not the logged players turn');

    //check: room is not finished
    if (roomQuery.rows[0].finished) throw new Error('the story has already been ended');

    //check: deadline has not passed
    if (roomQuery.rows[0].turn_end < new Date()) {
      //++update player turn
      throw new Error('turn has already passed');
    }

    //check: can end (if player wants to end)
    // if (isEnd) {
    //   const scenarioCountQuery = await db.query('SELECT COUNT(*) FROM scenarios WHERE room_id=$1', [roomId]);
    //   if (scenarioCountQuery.rows[0].count < 29) {
    //     throw new Error('You cannot end the story yet! It needs at least 30 paragraphs');
    //   }
    // }


    //MAKE THE TRANSACTION
    await db.query('BEGIN');
    //insert into scenarios
    const scenarioQuery = await db.query(
      'INSERT INTO scenarios(number_in_room, scenario, creator_id, room_id) VALUES ((SELECT MAX(number_in_room) FROM scenarios WHERE room_id = $3)+1, $1, $2, $3) RETURNING *',
      [scenario, user.id, roomId]
    );
    if (scenarioQuery.rows[0].number_in_room > 39) {
      throw Error('Scenario limit reached! Must create ending');
    }

    //update player turn, deadline, and finished (if ending)
    let i = 0;
    playerQuery.rows.forEach((player, j) => {
      if (player.user_id != user.id) return
      if (j == (playerQuery.rows.length - 1)) return;
      i = j + 1;
    })
    const nextPlayerId = playerQuery.rows[i].user_id;
    if (isEnd) nextPlayerId = null;
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
        (isEnd ? null : new Date(Date.now() + 172800000))
      ]
    );

    //update player character count
    if (!isEnd) {
      await db.query(
        'UPDATE rooms_users SET char_count = (char_count - $1 + 500) WHERE user_id = $2 AND room_id = $3',
        [scenario.length, user.id, roomId]
      );
    }

    if (isEnd) {
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
      )
    }

    //end transaction
    await db.query('COMMIT');
    if (isEnd) {
      res.status(200).send('new scenario added with id: ' + scenarioQuery.rows[0].id);
    }
    else {
      res.status(200).send('you ended the story! And got a key!: ' + scenarioQuery.rows[0].id);
    }
  }
  catch (error) {

    db.query('ROLLBACK');
    console.error('FAILED TO ADD NEW SCENARIO: ' + error.message);
    res.status(400).send('FAILED TO ADD NEW SCENARIO: ' + error.message);

  }

});


module.exports = scenarioRouter;  