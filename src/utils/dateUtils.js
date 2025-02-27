const moment = require('moment');

function getTimeUntil(timeStr) {
  const [hours, minutes] = timeStr.split(':');
  const nextTime = moment().startOf('day').add(hours, 'hours').add(minutes, 'minutes');
  if (nextTime.isBefore(moment())) {
    nextTime.add(1, 'day');
  }
  return moment.duration(nextTime.diff(moment()));
}

function formatDuration(duration) {
  const hours = duration.hours().toString().padStart(2, '0');
  const minutes = duration.minutes().toString().padStart(2, '0');
  const seconds = duration.seconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

module.exports = {
  getTimeUntil,
  formatDuration
}; 