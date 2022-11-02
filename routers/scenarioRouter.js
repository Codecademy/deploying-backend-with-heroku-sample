const express = require('express');
const scenarioRouter = express.Router();
const db = require('./dbFunctions');

const AttachAddScenarioTransaction = async (req, res, next) => {

  req.Transaction = async () => {

    const roomId = req.query.room_id;
    const scenario = req.query.text;
    const isEnd = (req.query.end == true);

    //initial error checks
    if (!roomId) throw new Error('No room_id provided');
    if (!scenario) throw new Error('No text provided');
    if (scenario.length < 3) throw new Error('text must be at least 3 characters long');

    //make queries
    const players = await db.GetPlayersInRoom(roomId);
    const room = await db.GetRoomInfo(roomId);

    //some db checks
    db.MakeSurePlayerHasEnoughChars(players, scenario);
    db.MakeSureItsPlayersTurn(room);
    db.MakeSureItsNotFinished(room);
    db.MakeSureDeadlineHasNotPassed(room);
    if (!isEnd) await db.MakeSureItsNotTheLastTurn(roomId);

    //carry out the transaction
    const scenarioId = await db.AddScenario(scenario, roomId);
    await db.UpdateRoomInfo(isEnd, room.full, roomId, players);
    if (isEnd) await db.GiveKeyToEachPlayer(roomId);
    else await db.UpdateCharCount(scenario, roomId);

    //send response
    if (!isEnd) req.responseMessage = 'new scenario added with id: ' + scenarioId
    else req.responseMessage = 'you ended the story! And got a key!: ' + scenarioId;
  }

  next();
}

scenarioRouter.post('/', AttachAddScenarioTransaction, db.TryTransaction);

module.exports = scenarioRouter;