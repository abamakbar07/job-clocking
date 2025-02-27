const Table = require('cli-table3');
const colors = require('colors');
const moment = require('moment');
const { getTimeUntil, formatDuration } = require('./dateUtils');

function createStatusTable(employee, employeeStates) {
  const statusTable = new Table({
    head: [
      'Event'.cyan,
      'Scheduled Time'.cyan,
      'Countdown'.cyan,
      'Status'.cyan
    ],
    style: { head: [], border: [] }
  });

  const events = [
    { name: 'Start Work', time: employee.schedule.startWorkTime },
    { name: 'Lunch Break', time: employee.schedule.lunchBreakStart },
    { name: 'End Break', time: employee.schedule.lunchBreakEnd },
    { name: 'End Work', time: employee.schedule.endWorkTime }
  ];

  events.forEach(event => {
    const timeUntil = getTimeUntil(event.time);
    const countdown = formatDuration(timeUntil);
    let status = 'Pending'.gray;
    
    if (timeUntil.asSeconds() <= 0) {
      status = 'Completed'.green;
    } else if (timeUntil.asHours() < 1) {
      status = 'Upcoming'.yellow;
    }

    statusTable.push([event.name, event.time, countdown, status]);
  });

  return statusTable;
}

// ... rest of console utilities

module.exports = {
  createStatusTable,
  updateConsole
}; 