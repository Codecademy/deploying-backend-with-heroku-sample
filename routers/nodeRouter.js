const express = require('express');
const nodeRouter = express.Router();
const dbFunctions = require('../database/dbFunctions');
const dbChecks = require('../database/dbChecks');
const dbPosts = require('../database/dbPosts');
const { isAuth } = require('../middleware/authentication');
const { ValidateChars } = require('../middleware/validation');
const balancing = require('../appInfo/balancing');

const GetFeed = async (req, res, next) => {

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

const TryAddNode = async (req, res, next) => {

  try {

    const userId = req.userId;
    const { campId } = req.query

    //initial error checks
    if (!campId) throw new Error('Please provide a campId');
    if (!userId) throw new Error('no userId. Make sure you have a valid token and are logged correctly')
    await dbChecks.CanAddNode(campId, userId);

    //post dat shit
    await dbPosts.AddNode(campId, userId);

    //send response
    res.send({
      ok: true,
      message: 'Node added!'
    });

  }
  catch (error) {
    console.error(error);
    res.status(400).send({ ok: false, message: error.message });
  }

}

const TryAddScenario = async (req, res, next) => {

  let transactionInitiated = false;

  try {

    const userId = req.userId;
    const { campId, text, end } = req.query
    const isEnd = (end == "true");

    //initial error checks
    ValidateChars(text);
    if (!campId) throw new Error('No room_id provided');
    if (!text) throw new Error('No text provided');
    if (text.length < balancing.numbers.scenarioMinCharacter) throw new Error('min chars in scenario: ', scenarioMinCharacters);
    if (text.length > balancing.numbers.scenarioMaxCharacters) throw new Error('max chars in scenario: ', scenarioMaxCharacters);
    if (!userId) throw new Error('no userId. Make sure you have a valid token and are logged correctly');
    await dbChecks.CanAddScenario(campId, userId, isEnd);

    //make queries
    let room = await dbFunctions.GetRoomInfo(campId);
    let players = await dbFunctions.GetPlayersInRoom(campId);
    let scenarios = await dbFunctions.GetScenariosInRoom(campId);

    const correctionsMade = await dbFunctions.CheckRoomInfo(room, players, scenarios);
    if (correctionsMade) {
      room = await dbFunctions.GetRoomInfo(campId);
      players = await dbFunctions.GetPlayersInRoom(campId);
      scenarios = await dbFunctions.GetScenariosInRoom(campId);
    }

    //some db checks
    dbFunctions.MakeSurePlayerIsActive(players, userId);
    dbFunctions.MakeSurePlayerHasEnoughChars(players, text, userId);
    dbFunctions.MakeSureItsPlayersTurn(room, userId);

    //transaction (things in here will be rolled back on error)
    await dbFunctions.BeginTransaction();
    transactionInitiated = true;

    const scenarioId = await dbFunctions.AddScenario(text, campId, userId);

    if (isEnd) {
      await dbFunctions.EndStory(campId);
    }
    else {
      await dbFunctions.CreateNewNode(campId);
      await dbFunctions.PassTurn(room, userId);
      await dbFunctions.UpdateCharCount(text, campId, userId);
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

nodeRouter.use(isAuth);
nodeRouter.post('/', TryAddNode);
// nodeRouter.post('/scenario', TryAddScenario);
nodeRouter.get('/feed', GetFeed);

module.exports = nodeRouter;