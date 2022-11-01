const express = require('express');
const scenarioRouter = express.Router();
const dbFunctions = require('./dbFunctions');

scenarioRouter.post('/', async (req, res) => {

  const roomId = req.query.room_id;
  const scenario = req.query.text;
  const isEnd = (req.query.end == true);

  try {

    if (!roomId) throw new Error('No room_id provided');
    if (!scenario) throw new Error('No text provided');
    if (scenario.length < 3) throw new Error('text must be at least 3 characters long');

    const playerQuery = await dbFunctions.GetPlayersInRoom(roomId);
    const roomQuery = await dbFunctions.GetRoomInfo(roomId);

    dbFunctions.MakeSurePlayerHasEnoughChars(playerQuery, scenario);
    dbFunctions.MakeSureItsPlayersTurn(roomQuery);
    dbFunctions.MakeSureItsNotFinished(roomQuery);
    dbFunctions.MakeSureDeadlineHasNotPassed(roomQuery);
    if (!isEnd) await dbFunctions.MakeSureItsNotTheLastTurn(roomId);

    await dbFunctions.BeginTransaction();

    const scenarioId = await dbFunctions.AddScenario(scenario, roomId);
    await dbFunctions.UpdateRoomInfo(isEnd, roomQuery.rows[0].full, roomId, playerQuery);
    if (isEnd) await dbFunctions.GiveKeyToEachPlayer(roomId);
    else await dbFunctions.UpdateCharCount(scenario, roomId);

    await dbFunctions.Commit();

    if (!isEnd) res.status(200).send('new scenario added with id: ' + scenarioId);
    else res.status(200).send('you ended the story! And got a key!: ' + scenarioId);

  }
  catch (error) {

    dbFunctions.Rollback();
    console.error(error);
    res.status(400).send('FAILED TO ADD NEW SCENARIO: ' + error.message);

  }

});

module.exports = scenarioRouter;