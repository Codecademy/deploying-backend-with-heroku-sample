const express = require('express');
const scenarioRouter = express.Router();
const dbFunctions = require('../database/dbFunctions');
const { isAuth } = require('../middleware/authentication');
const { SendTurnNotification } = require('../notifications/notifications')

const AttachAddScenarioTransaction = async (req, res, next) => {

  req.Transaction = async () => {

    const userId = req.userId;
    const { roomId, text } = req.query
    const isEnd = (req.query.end == true);

    //initial error checks
    if (!roomId) throw new Error('No room_id provided');
    if (!text) throw new Error('No text provided');
    if (text.length < 3) throw new Error('text must be at least 3 characters long');
    if (!userId) throw new Error('no userId. Make sure you have a valid token and are logged correctly')

    //make queries
    const room = await dbFunctions.GetRoomInfo(roomId);
    const players = await dbFunctions.GetPlayersInRoom(roomId);
    const scenarios = await dbFunctions.GetScenariosInRoom(roomId)
    const turnCorrectionMade = await dbFunctions.CheckRoomInfo(room, players, scenarios);

    if (turnCorrectionMade) {
      req.responseMessage = 'Its not your turn to write';
    }
    else {
      //some db checks
      dbFunctions.MakeSurePlayerIsActive(players, userId);
      dbFunctions.MakeSurePlayerHasEnoughChars(players, text, userId);
      dbFunctions.MakeSureItsPlayersTurn(room, userId);
      dbFunctions.MakeSureItsNotFinished(room);
      if (!isEnd) await dbFunctions.MakeSureItsNotTheLastTurn(roomId);

      //carry out the transaction
      const scenarioId = await dbFunctions.AddScenario(text, roomId, userId);
      const nextPlayerId = (isEnd || !room.full) ? null : dbFunctions.GetNextPlayerId(players, userId);
      //const turnEnd = (isEnd || !room.full) ? null : new Date(Date.now() + 172800000);
      //await dbFunctions.UpdateRoomInfo(isEnd, roomId, nextPlayerId, turnEnd);

      if (isEnd) {
        await dbFunctions.EndStory(roomId);
      }
      else {
        await dbFunctions.PassTurn(room, userId);
        await dbFunctions.UpdateCharCount(text, roomId, userId);
      }

      //send response
      if (!isEnd) req.responseMessage = 'new scenario added with id: ' + scenarioId
      else req.responseMessage = 'you ended the story! And got a key!: ' + scenarioId;
    }
  }

  next();
}

scenarioRouter.use(isAuth);
scenarioRouter.post('/', AttachAddScenarioTransaction, dbFunctions.TryTransaction);

module.exports = scenarioRouter;