const { Expo } = require('expo-server-sdk');
const dbFunctions = require('../database/dbFunctions');

let expo = new Expo();

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

const SendTestNotification = () => {

  SendNotification(
    'ExponentPushToken[ZeNN1xHXaxNE3Nl0NBQxMT]',
    'Scheduled notification',
    'Hello smoggy! you should receive this notification when heroku runs its script :)',
    {}
  )

}

module.exports = { SendTurnNotification, SendStrikeNotification, SendKickNotification, SendTestNotification };