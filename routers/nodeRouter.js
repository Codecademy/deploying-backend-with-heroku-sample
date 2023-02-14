const express = require('express');
const nodeRouter = express.Router();

const dbChecks = require('../database/dbChecks');
const dbPosts = require('../database/dbPosts');
const dbTransactions = require('../database/dbTransactions');
const dbData = require('../database/dbData');

const { isAuth } = require('../middleware/authentication');
const { ValidateChars } = require('../middleware/validation');
const balancing = require('../appInfo/balancing');
const notifications = require('../notifications/notifications');

const GetFeed = async (req, res, next) => {

  try {


    const feed = await dbData.Feed();

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

  let transactionInitiated = false;

  try {

    const userId = req.userId;
    const { campId } = req.query

    //initial error checks
    if (!campId) throw new Error('Please provide a campId');
    if (!userId) throw new Error('no userId. Make sure you have a valid token and are logged correctly')
    await dbChecks.CanAddNode(campId, userId);

    //post dat shit
    await dbTransactions.Begin();
    transactionInitiated = true;
    const prompt = await dbPosts.AddNode(campId, userId);
    await dbTransactions.Commit();

    //send response
    res.send({
      ok: true,
      message: 'Node added! Created a prompt',
      data: { prompt }
    });

  }
  catch (error) {
    if (transactionInitiated) dbTransactions.Rollback();
    console.error(error);
    res.status(400).send({ ok: false, message: error.message });
  }

}

const TryAddScenario = async (req, res, next) => {

  let transactionInitiated = false;

  try {

    //params
    const userId = req.userId;
    const { campId, text, end } = req.query
    const isEnd = (end == "true");

    //checks
    ValidateChars(text);
    if (!campId) throw new Error('No room_id provided');
    if (!text) throw new Error('No text provided');
    if (text.length < balancing.numbers.scenarioMinCharacter) throw new Error('min chars in scenario: ', scenarioMinCharacters);
    if (text.length > balancing.numbers.scenarioMaxCharacters) throw new Error('max chars in scenario: ', scenarioMaxCharacters);
    if (!userId) throw new Error('no userId. Make sure you have a valid token and are logged correctly');
    await dbChecks.CanAddScenario(campId, userId, isEnd);

    //transaction
    await dbTransactions.Begin();
    transactionInitiated = true;
    await dbPosts.AddScenario(campId, text, isEnd);
    await dbTransactions.Commit();

    //notify everyone in a story!
    const creatorName = await dbData.PlayerName(userId);
    const storyTitle = await dbData.StoryTitle(campId);
    notifications.SendScenarioNotifications(campId, userId, creatorName, storyTitle);

    //send response
    let responseMessage = 'new scenario added!';
    if (isEnd) responseMessage = 'you ended the story! And got a log!';
    res.send({ ok: true, message: responseMessage });
  }
  catch (error) {
    if (transactionInitiated) dbTransactions.Rollback();
    console.error(error);
    res.status(400).send({ ok: false, message: error.message });
  }

}

nodeRouter.use(isAuth);
nodeRouter.post('/', TryAddNode);
nodeRouter.post('/scenario', TryAddScenario);
nodeRouter.get('/feed', GetFeed);

module.exports = nodeRouter;