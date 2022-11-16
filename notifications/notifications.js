const { Expo } = require('expo-server-sdk');

let expo = new Expo();


const SendPushNotification = async (pushToken, title, body, data) => {

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
    console.log('sent notification!');
    console.log(ticketChunk);
  } catch (error) {
    console.error(error);
  }

}

const SendTurnNotification = (roomId, storyTitle, user) => {
  SendPushNotification(
    user.expo_push_token,
    `Your turn, ${user.name}!`,
    storyTitle + ' was updated. You are the next player in line to write!',
    {
      type: 'turn',
      roomId: roomId,
      userId: user.id
    }
  );

}

module.exports = { SendTurnNotification };