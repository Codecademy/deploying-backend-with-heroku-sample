const { Expo } = require('expo-server-sdk');
const dbData = require('../database/dbData');

let expo = new Expo();

//ACTIVE
const SendNotification = async (pushToken, title, body, data) => {

  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  }

  const chunks = expo.chunkPushNotifications([message]);
  const chunk = chunks[0];

  try {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
  } catch (error) {
    console.error(error);
  }

}

const SendTestNotification = () => {

  SendNotification(
    'ExponentPushToken[ZeNN1xHXaxNE3Nl0NBQxMT]',
    'Scheduled notification',
    'Hello smoggy! you should receive this notification when heroku runs its script :)',
    {}
  )

}

const SendScenarioNotifications = async (campId, creatorId, creatorName, storyTitle) => {

  //get the expo tokens for the given camp id EXCEPT for the poster
  const tokens = await dbData.GetCampPlayersExpoTokens(campId, creatorId);

  //create the messages
  let messages = [];
  for (let token of tokens) {

    if (!Expo.isExpoPushToken(token)) {
      console.error(`Push token ${token} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: token,
      sound: 'default',
      title: `${creatorName} updated "${storyTitle}"!`,
      body: 'Jump into Unwritten to keep writing',
      data: {
        type: 'scenario',
        roomId: campId,
      },
    })
  }

  //chunk and send them
  const chunks = expo.chunkPushNotifications(messages);
  let tickets = [];
  (async () => {
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }
  })();

}

//LEGACY
const SendTurnNotification = (pushToken, roomId, storyTitle, userId) => {

  SendNotification(
    pushToken,
    'Your turn!',
    storyTitle + ' was updated. You are the next player in line to write!',
    {
      type: 'turn',
      roomId: roomId,
      userId: userId
    }
  );

}

const SendStrikeNotification = async (pushToken, storyTitle, strikes, roomId, userId) => {

  SendNotification(
    pushToken,
    `❌ You missed your turn in "${storyTitle}"`,
    `You now have ${strikes} strikes. 3 Strikes and you are out!`,
    {
      type: 'strike',
      roomId: roomId,
      userId: userId
    }
  )

}

const SendKickNotification = async (pushToken, storyTitle) => {

  SendNotification(
    pushToken,
    `You got kicked from "${storyTitle}"`,
    `You missed 3 turns. You will no longer be able to contribute to this story`,
    {
      type: 'kick',
    }
  )

}


module.exports = {
  SendTurnNotification,
  SendStrikeNotification,
  SendKickNotification,
  SendTestNotification,
  SendScenarioNotifications
};