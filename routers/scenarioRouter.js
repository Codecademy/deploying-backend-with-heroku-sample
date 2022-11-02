const express = require('express');
const scenarioRouter = express.Router();
const db = require('./dbFunctions');

const AttachAddScenarioTransaction = async (req, res, next) => {

  req.Transaction = async () => {

    const roomId = req.query.room_id;
    const scenario = req.query.text;
    const isEnd = (req.query.end == true);

    if (!roomId)
      throw new Error('No room_id provided');
    if (!scenario)
      throw new Error('No text provided');
    if (scenario.length < 3)
      throw new Error('text must be at least 3 characters long');

    //make queries
    const playerQuery = await db.GetPlayersInRoom(roomId);
    const roomQuery = await db.GetRoomInfo(roomId);

    //some db checks
    db.MakeSureRoomExists(roomQuery);
    db.MakeSurePlayerHasEnoughChars(playerQuery, scenario);
    db.MakeSureItsPlayersTurn(roomQuery);
    db.MakeSureItsNotFinished(roomQuery);
    db.MakeSureDeadlineHasNotPassed(roomQuery);
    if (!isEnd)
      await db.MakeSureItsNotTheLastTurn(roomId);

    //carry out the transaction
    const scenarioId = await db.AddScenario(scenario, roomId);
    await db.UpdateRoomInfo(isEnd, roomQuery.rows[0].full, roomId, playerQuery);
    if (isEnd) await db.GiveKeyToEachPlayer(roomId);
    else await db.UpdateCharCount(scenario, roomId);

    //send response
    if (!isEnd) req.responseMessage = 'new scenario added with id: ' + scenarioId
      // res.status(200).send('new scenario added with id: ' + scenarioId);
    else
      //res.status(200).send('you ended the story! And got a key!: ' + scenarioId);
      req.responseMessage = 'you ended the story! And got a key!: ' + scenarioId;
  }

  next();
}

scenarioRouter.post('/', AttachAddScenarioTransaction, db.TryTransaction);

module.exports = scenarioRouter;