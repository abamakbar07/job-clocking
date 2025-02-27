const Table = require('cli-table3');
const colors = require('colors');
const moment = require('moment');
const { getTimeUntil, formatDuration } = require('./dateUtils');

function createStatusTable(employee, employeeState) {
  const statusTable = new Table({
    head: [
      'Event'.cyan,
      'Scheduled Time'.cyan,
      'Countdown'.cyan,
      'Status'.cyan,
      'Current Activity'.cyan
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

    statusTable.push([
      event.name,
      event.time,
      countdown,
      status,
      employeeState?.currentActivity || 'None'
    ]);
  });

  return statusTable;
}

function updateConsole(employees, employeeStates) {
  console.clear();
  console.log('Job Clocking Automation'.green.bold);
  console.log('Current Time:'.cyan, moment().format('M/D/YYYY HH:mm:ss'));
  
  employees.forEach(employee => {
    if (employee.enabled) {
      console.log(`\nEmployee: ${employee.name}`.yellow);
      console.log(createStatusTable(employee, employeeStates[employee.shortId]).toString());
    }
  });
}

module.exports = {
  createStatusTable,
  updateConsole
}; 