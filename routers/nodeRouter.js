const express = require('express');
const nodeRouter = express.Router();
const dbFunctions = require('../database/dbFunctions');
const dbChecks = require('../database/dbChecks');
const dbPosts = require('../database/dbPosts');
const { isAuth } = require('../middleware/authentication');
const { ValidateChars } = require('../middleware/validation');

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

nodeRouter.use(isAuth);
nodeRouter.post('/', TryAddNode);
// nodeRouter.post('/scenario', TryAddScenario);
nodeRouter.get('/feed', GetFeed);

module.exports = nodeRouter;