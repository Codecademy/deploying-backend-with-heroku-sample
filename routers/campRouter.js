const express = require('express');
const campRouter = express.Router();
const { isAuth } = require('../middleware/authentication');
const dbData = require('../database/dbData');

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

campRouter.use(isAuth);
campRouter.get('/data/:id', GetCampData);

module.exports = campRouter;