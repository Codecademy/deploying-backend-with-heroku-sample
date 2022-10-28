const express = require('express');
const scenarioRouter = express.Router();
const db = require('./dbConnect.js');
const user = require('../fakeData/testUser');

scenarioRouter.post('/', async (req,res) => {

  try {

    //check: room_id provided¨
    if(!req.query.room_id) throw new Error('No room_id provided');

    //checK: scenario text provided
    if(!req.query.text) throw new Error('No text provided');

    //check: scenario text is long enough
    if(req.query.text.length < 3) throw new Error('text must be at least 3 characters long');

    //check: player has enough characters
    const playerQuery = await db.query( //might not be necessary, since we will query this table any way and can return the player
      'SELECT * FROM rooms_users WHERE user_id = $1',
      [user.id]
    )
    if(playerQuery.rows[0].char_count < req.query.text.length) throw new Error('player does not have enough characters left');

    //check: its the players turn
    const roomQuery = await db.query(
      'SELECT * FROM rooms WHERE id=$1',
      [req.query.room_id]
    );
    if(roomQuery.rows[0].next_player_id != user.id) throw new Error('its not the logged players turn');

    //check: room is not finished
    if(roomQuery.rows[0].finished) throw new Error('the story has already been ended');

    //check: deadline has not passed
    if(roomQuery.rows[0].turn_end < new Date()){
      //update player turn
      throw new Error('turn has already passed');
    }
    
    //insert into scenarios
    //update player turn
    //sets finished if full scenario count
    //update player character count
    
  } catch (error) {
    
  }

});


module.exports = scenarioRouter;