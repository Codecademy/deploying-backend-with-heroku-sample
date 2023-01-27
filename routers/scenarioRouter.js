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
    const isEnd = (req.query.end == "true");

    await dbFunctions.MakeSureItsNotFinished(roomId);

    //checka om end vs scenario - att det verkligen är tillåtet
    if (isEnd) {
      const canEnd = await dbFunctions.CanEnd(roomId);
      if (!canEnd) throw new Error(`Cant end the story yet! Not enough paragraphs written`);
    }
    else {
      await dbFunctions.MakeSureItsNotTheLastTurn(roomId);
    }

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
    if (transactionInitiated) dbFunctions.Rollback();
    console.error(error);
    res.status(400).send({ ok: false, message: error.message });
  }
}
const GetScenarioFeed = async (req, res, next) => {

  try {

    const feed = await dbFunctions.GetScenarioFeed();

    if (!feed || feed.length < 1) {
      console.error('could not get feed. backend threw back: ', feed);
      throw new Error('could not get a feed');
    };

    res.status(200).send({
      ok: true,
      message: 'successfully retrieved scenario feed',
      data: feed
    })

  } catch (error) {

    console.error(error);
    res.status(400).send({
      ok: false,
      message: error.message
    });

  }

}
const GetPrompt = async (req, res, next) => {

  try {

    //get prompt from db
    const prompt = await dbFunctions.GetRandomPrompt();

    //check to make sure you got a valid one
    if (!prompt || prompt.length < 1) throw new Error('could not get prompt');

    res.status(200).send({
      ok: true,
      message: 'successfully retrieved a prompt',
      data: prompt
    })

  } catch (error) {

    console.error(error);
    res.status(400).send({
      ok: false,
      message: error.message
    });

  }

}

scenarioRouter.use(isAuth);
scenarioRouter.post('/', TryAddScenario);
scenarioRouter.get('/feed', GetScenarioFeed);
scenarioRouter.get('/prompt', GetPrompt);

module.exports = scenarioRouter;