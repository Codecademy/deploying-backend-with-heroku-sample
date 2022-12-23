const express = require('express');
const scenarioRouter = express.Router();
const dbFunctions = require('../database/dbFunctions');
const { isAuth } = require('../middleware/authentication');
const { ValidateChars } = require('../middleware/validation');

const TryAddScenario = async (req, res, next) => {

  let transactionInitiated = false;

  try {

    const userId = req.userId;
    const { roomId, text } = req.query
    const isEnd = (req.query.end == true);

    //initial error checks
    ValidateChars(text);
    if (!roomId) throw new Error('No room_id provided');
    if (!text) throw new Error('No text provided');
    if (text.length < 3) throw new Error('text must be at least 3 characters long');
    if (!userId) throw new Error('no userId. Make sure you have a valid token and are logged correctly')

    //make queries
    let room = await dbFunctions.GetRoomInfo(roomId);
    let players = await dbFunctions.GetPlayersInRoom(roomId);
    let scenarios = await dbFunctions.GetScenariosInRoom(roomId);

    const correctionsMade = await dbFunctions.CheckRoomInfo(room, players, scenarios);
    if (correctionsMade) {
      room = await dbFunctions.GetRoomInfo(roomId);
      players = await dbFunctions.GetPlayersInRoom(roomId);
      scenarios = await dbFunctions.GetScenariosInRoom(roomId);
    }

    //some db checks
    dbFunctions.MakeSurePlayerIsActive(players, userId);
    dbFunctions.MakeSurePlayerHasEnoughChars(players, text, userId);
    dbFunctions.MakeSureItsPlayersTurn(room, userId);
    dbFunctions.MakeSureItsNotFinished(room);
    if (!isEnd) await dbFunctions.MakeSureItsNotTheLastTurn(roomId);

    //transaction (things in here will be rolled back on error)
    await dbFunctions.BeginTransaction();
    transactionInitiated = true;

    const scenarioId = await dbFunctions.AddScenario(text, roomId, userId);

    if (isEnd) {
      await dbFunctions.EndStory(roomId);
    }
    else {
      await dbFunctions.PassTurn(room, userId);
      await dbFunctions.UpdateCharCount(text, roomId, userId);
    }

    await dbFunctions.Commit();

    //send response
    let responseMessage;
    if (!isEnd) responseMessage = 'new scenario added with id: ' + scenarioId
    else responseMessage = 'you ended the story! And got a key!: ' + scenarioId;
    res.send({ ok: true, message: responseMessage });
  }
  catch (error) {
    if (transactionInitiated) Rollback();
    console.error(error);
    res.status(400).send({ ok: false, message: error.message });
  }
}

scenarioRouter.use(isAuth);
scenarioRouter.post('/', TryAddScenario);

module.exports = scenarioRouter;