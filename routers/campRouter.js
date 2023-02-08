//IMPORTS
const express = require('express');
const campRouter = express.Router();

const { isAuth } = require('../middleware/authentication');
const { ValidateChars } = require('../middleware/validation');

const dbData = require('../database/dbData');
const dbTransactions = require('../database/dbTransactions');
const dbPosts = require('../database/dbPosts');
const dbUpdates = require('../database/dbUpdates');

const balancing = require('../appInfo/balancing');

//FUNCTIONS
const CreateCamp = async (req, res, next) => {

  let transactionInitiated = false;

  try {

    const { userId } = req;
    const { title, description, scenario } = req.query;
    const balanceSheet = balancing.numbers;

    //ERROR CHECKS
    if (!title) throw new Error('Please provide a title');
    if (title.length < balanceSheet.titleMinChars) throw new Error('Title is too short. Minimum chars: ', titleMinChars);
    if (title.length > balanceSheet.titleMaxChars) throw new Error('Title is too long. Maximum chars: ', titleMaxChars);
    if (!description) throw new Error('Please provide a description');
    if (description.length < balanceSheet.descriptionMinChars) throw new Error('Description is too short. Minimum chars: ', descriptionMinChars);
    if (description.length > balanceSheet.descriptionMaxChars) throw new Error('Description is too long. Maximum chars: ', descriptionMaxChars);
    if (!scenario) throw new Error('Please provide a starting scenario');
    if (scenario.length < balanceSheet.scenarioMinCharacter) throw new Error('Scenario is too short. Minimum chars: ', scenarioMinCharacter);
    if (scenario.length > balanceSheet.scenarioMaxCharacters) throw new Error('Scenario is too long. Maximum chars: ', scenarioMaxCharacters);
    ValidateChars(title);
    ValidateChars(description);
    ValidateChars(scenario);

    //TRY ADD TO DATABASE
    await dbTransactions.Begin();
    transactionInitiated = true;
    await dbUpdates.RemoveLog(userId);
    const campId = await dbPosts.Camp(title, description, scenario, userId);
    await dbTransactions.Commit();

    res.status(200).send({
      ok: true,
      message: 'New camp created successfully!',
      campId: campId
    });

  }
  catch (error) {

    if (transactionInitiated) dbTransactions.Rollback();
    const message = 'Failed to create camp: ' + error.message;
    console.error(message);
    res.status(400).send({
      ok: false,
      message: message
    });

  }

}

const GetCampData = async (req, res, next) => {

  try {

    const campId = req.params.id;

    const camp = await dbData.CampData(campId);
    const players = await dbData.PlayersInCamp(campId);
    const scenarios = await dbData.ScenariosInCamp(campId);
    const lastNode = await dbData.LastNodeInCamp(campId);

    camp.players = players;
    camp.scenarios = scenarios;
    camp.lastNode = lastNode;

    res.status(200).send(camp);

  }
  catch (error) {

    console.error(error);
    res.status(400).send('Failed to get room: ' + error.message);

  }

}

const GetActiveCamps = async (req, res, next) => {

  try {

    const { userId } = req;
    const camps = await dbData.ActiveCamps(userId);
    res.status(200).send({
      ok: true,
      message: 'found camps',
      data: camps
    });

  }
  catch (error) {

    console.error(error);
    res.status(400).send('Failed to get active camps: ' + error.message);

  }

}

const GetPlayerCamps = async (req, res, next) => {

  try {

    const { userId } = req;
    const camps = await dbData.PlayerCamps(userId);
    res.status(200).send({
      ok: true,
      message: 'found camps',
      data: camps
    });

  }
  catch (error) {

    console.error(error);
    res.status(400).send('Failed to get active camps: ' + error.message);

  }

}

//ROUTES
campRouter.use(isAuth);
campRouter.get('/data/:id', GetCampData);
campRouter.get('/active', GetActiveCamps);
campRouter.get('/player', GetPlayerCamps);
campRouter.post('/', CreateCamp);

//ROUTER EXPORT
module.exports = campRouter;