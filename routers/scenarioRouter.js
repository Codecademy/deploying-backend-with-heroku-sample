const express = require('express');
const scenarioRouter = express.Router();
const db = require('./dbConnect.js')

scenarioRouter.get('/', async (req, res) => { 
  res.send('you tried to get all scenarios! lol! when would you even need that? you little shit. Dont make these requests.')
});

module.exports = scenarioRouter;