const db = require('../database/dbConnect');
const { HandleDeadlinePassed, CheckRoomDeadline } = require('../database/dbFunctions');

const checkDeadlines = async () => {

  const query = await db.query(
    `SELECT *, EXTRACT(epoch FROM (turn_end - NOW())/3600) AS time_left
    FROM rooms
    WHERE turn_end - NOW() < Interval '30 min'
    AND finished = false
    AND next_player_id IS NOT NULL`
  )

  if (query.rowCount < 1) return;

  const now = new Date();

  query.rows.forEach(room => {

    if (room.time_left < 0) {
      HandleDeadlinePassed(room)
    }
    else {
      const delay = room.time_left * 60 * 60 * 1000;
      setTimeout(CheckRoomDeadline, delay, room);
    }
  })


}

checkDeadlines();