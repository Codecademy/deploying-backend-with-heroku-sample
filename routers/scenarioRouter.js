const express = require('express');
const scenarioRouter = express.Router();
const db = require('./dbFunctions');

scenarioRouter.post('/', async (req, res) => {

  db.TryTransaction(
    async () => { await TryAddScenario(req.query.room_id, req.query.text, (req.query.end == true), res); },
    res
  )

});

module.exports = scenarioRouter;

async function TryAddScenario(roomId, scenario, isEnd, res) {

  //some initial checks
  if (!roomId)
    throw new Error('No room_id provided');
  if (!scenario)
    throw new Error('No text provided');
  if (scenario.length < 3)
    throw new Error('text must be at least 3 characters long');

  //make queries
  const playerQuery = await db.GetPlayersInRoom(roomId);
  const roomQuery = await db.GetRoomInfo(roomId);

  //some db checks
  db.MakeSurePlayerHasEnoughChars(playerQuery, scenario);
  db.MakeSureItsPlayersTurn(roomQuery);
  db.MakeSureItsNotFinished(roomQuery);
  db.MakeSureDeadlineHasNotPassed(roomQuery);
  if (!isEnd)
    await db.MakeSureItsNotTheLastTurn(roomId);

  //carry out the transaction
  await db.BeginTransaction();
  const scenarioId = await db.AddScenario(scenario, roomId);
  await db.UpdateRoomInfo(isEnd, roomQuery.rows[0].full, roomId, playerQuery);
  if (isEnd)
    await db.GiveKeyToEachPlayer(roomId);
  else
    await db.UpdateCharCount(scenario, roomId);
  await db.Commit();

  //sebd response
  if (!isEnd)
    res.status(200).send('new scenario added with id: ' + scenarioId);
  else
    res.status(200).send('you ended the story! And got a key!: ' + scenarioId);
}

