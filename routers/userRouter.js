const express = require('express');
const userRouter = express.Router();
const dbData = require('../database/dbData');
const dbPosts = require('../database/dbPosts');
const { isAuth } = require('../middleware/authentication');
const { ValidateCharsNoEmojis } = require('../middleware/validation');
const fetch = require('node-fetch');
const { StampLogin } = require('../database/dbPosts');

const GetUserInfo = async (req, res, next) => {

  try {
    const googleToken = req.headers['authorization'];
    const user = await dbData.PlayerWithGoogleToken(req.headers['authorization'])
    res.json({
      id: user.id,
      name: user.name,
      room_keys: user.room_keys,
      // email: user.email,
      // premium: user.premium
    });
  }
  catch (error) {
    res.status(400).send('Unable to get user. ' + error.message);
  }

}
const GetUserStats = async (req, res, next) => {

  try {

    const { userId } = req.query;
    if (!userId) throw new Error('no user id provided in query. Cannot return stats');
    const stats = await dbData.PlayerStats(userId);

    res.status(200).send({
      ok: true,
      message: 'successfully retrieved user stats',
      data: stats
    })

  }
  catch (error) {

    res.status(400).send({
      ok: false,
      message: 'Could not retrieve stats: ' + error.message,
    })

  }

}
const Login = async (req, res, next) => {
  try {

    const googleToken = req.headers['authorization'];
    if (!googleToken) throw new Error('no google token in auth header');

    //fetch user from google using the token
    let response = await fetch("https://www.googleapis.com/userinfo/v2/me", {
      headers: { Authorization: `Bearer ${googleToken}` }
    });
    const userInfo = await response.json();

    if (userInfo.error) {
      console.error('user tried to log in with invalid token. Error: ', userInfo.error);
      throw new Error('Invalid google token');
    }

    //token is valid! and we got some info from the google api
    const googleId = userInfo.id;

    //use it to get player from the db
    let player = await dbData.Player(googleId);

    //correct anything that is missing in the user db
    if (!player) {
      player = await dbPosts.NewPlayer(googleId, googleToken);
      if (!player) throw new Error('unable to add new player to the database');
    }
    else if (player.google_token != googleToken) {
      player = await dbPosts.UpdateGoogleToken(googleId, googleToken);
      if (!player) throw new Error('unable to update google token in database');
    }

    //add a login row in db for tracking
    await StampLogin(player.id);

    console.log('player logged in. ID: ', player.id);

    //and return the player!
    res.status(201).send({
      ok: true,
      message: 'succesfully logged in!',
      data: {
        player: {
          id: player.id,
          displayName: player.name,
          keys: player.room_keys,
        }
      }
    });

  }
  catch (error) {
    console.log('player failed to login: ', error.message);
    res.status(400).send({
      ok: false,
      message: 'Cant login: ' + error.message,
    });

  }
}
const SetDisplayName = async (req, res, next) => {

  try {

    const { name } = req.query;
    const googleToken = req.headers['authorization'];

    //checks
    if (name.length < 3) throw new Error('Name must be at least 4 chars long');
    ValidateCharsNoEmojis(name);

    //post it
    await dbPosts.Name(googleToken, name);

    //response
    res.status(201).send({
      ok: true,
      message: 'succesfully updated name!',
      data: {
        name: name
      }
    });

  }
  catch (error) {

    //fail response
    res.status(400).send({
      ok: false,
      message: 'Cant update name: ' + error.message,
    });

  }

}
const SetExpoToken = async (req, res, next) => {

  try {

    const { expoToken } = req.query;
    const googleToken = req.headers['authorization'];

    //checks
    if (!expoToken) throw new Error('No expo token provided');
    if (!googleToken) throw new Error('No auth header provided');
    // ValidateCharsNoEmojis(expoToken);

    //post it
    await dbPosts.ExpoToken(googleToken, expoToken);

    //response
    res.status(201).send({
      ok: true,
      message: 'succesfully updated expo token for notifications!',
      data: {
        expoToken: expoToken
      }
    });

  }
  catch (error) {

    //fail response
    res.status(400).send({
      ok: false,
      message: 'Cant update expo token: ' + error.message,
    });

  }

}

userRouter.get('/', isAuth, GetUserInfo);
userRouter.get('/stats', isAuth, GetUserStats);
userRouter.post('/login', Login);
userRouter.post('/name', isAuth, SetDisplayName);
userRouter.post('/expoToken', isAuth, SetExpoToken);

module.exports = userRouter;