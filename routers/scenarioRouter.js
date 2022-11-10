const express = require('express');
const scenarioRouter = express.Router();
const dbFunctions = require('../database/dbFunctions');
const {isAuth} = require('../middleware/authentication');

const AttachAddScenarioTransaction = async (req, res, next) => {

  req.Transaction = async () => {

    const roomId = req.query.room_id;
    const scenario = req.query.text;
    const isEnd = (req.query.end == true);
    const userId = req.userId;

    //initial error checks
    if (!roomId) throw new Error('No room_id provided');
    if (!scenario) throw new Error('No text provided');
    if (scenario.length < 3) throw new Error('text must be at least 3 characters long');

    //make queries
    const players = await dbFunctions.GetPlayersInRoom(roomId);
    const room = await dbFunctions.GetRoomInfo(roomId);

    //some db checks
    dbFunctions.MakeSurePlayerHasEnoughChars(players, scenario, userId);
    dbFunctions.MakeSureItsPlayersTurn(room, userId);
    dbFunctions.MakeSureItsNotFinished(room);
    dbFunctions.MakeSureDeadlineHasNotPassed(room);
    if (!isEnd) await dbFunctions.MakeSureItsNotTheLastTurn(roomId);

    //carry out the transaction
    const scenarioId = await dbFunctions.AddScenario(scenario, roomId, userId);
    await dbFunctions.UpdateRoomInfo(isEnd, room.full, roomId, players, userId);
    if (isEnd) await dbFunctions.GiveKeyToEachPlayer(roomId);
    else await dbFunctions.UpdateCharCount(scenario, roomId, userId);

    //send response
    if (!isEnd) req.responseMessage = 'new scenario added with id: ' + scenarioId
    else req.responseMessage = 'you ended the story! And got a key!: ' + scenarioId;
  }

  next();
}

scenarioRouter.use(isAuth);
scenarioRouter.post('/', AttachAddScenarioTransaction, dbFunctions.TryTransaction);

module.exports = scenarioRouter;