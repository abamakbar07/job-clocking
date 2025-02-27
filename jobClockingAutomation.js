const schedule = require('node-schedule');
const axios = require('axios');
const moment = require('moment');
const colors = require('colors');
const Table = require('cli-table3');
const employees = require('./employees.json');

// First, install the correct dependencies:
// npm install colors cli-table3

const API_BASE_URL = 'http://rpt.apac.dsv.com:81/api/JobClocking';
const DEVICE_IP = '10.132.96.240';

const headers = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'content-type': 'application/json',
  'Referer': 'http://jobclocking.apac.dsv.com/',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// Global state to track current job clocking IDs
const employeeStates = {};

// Helper functions
const formatEmployeeId = (shortId) => `21.${shortId}/ID-JKT`;

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

// Updated console display function
function updateConsole() {
  console.clear();
  
  // Header
  console.log('='.repeat(80).blue.bold);
  console.log(`Job Clocking Automation - Current Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`.white.bold);
  console.log('='.repeat(80).blue.bold);
  console.log();

  employees.forEach(employee => {
    if (employee.enabled) {
      // Create employee status table
      const statusTable = new Table({
        head: [
          'Event'.cyan,
          'Scheduled Time'.cyan,
          'Countdown'.cyan,
          'Status'.cyan
        ],
        style: {
          head: [],
          border: []
        }
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
        
        // Determine status
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
          status
        ]);
      });

      // Employee header
      console.log(`Employee: ${employee.name} (ID: ${employee.shortId})`.green.bold);
      
      // Current status
      const currentState = employeeStates[employee.shortId] || { currentJobClockingId: 'None', currentActivity: 'None' };
      console.log(`Current Job Clocking ID: ${currentState.currentJobClockingId}`.yellow);
      console.log(`Current Activity: ${currentState.currentActivity}`.yellow);
      
      // Schedule table
      console.log(statusTable.toString());
      console.log(); // Add spacing between employees
    }
  });

  // Footer with legend
  console.log('='.repeat(80).blue.bold);
  console.log('Legend:'.dim);
  console.log('✓ Completed'.green + '  ⚠ Upcoming'.yellow + '  ○ Pending'.gray);
  console.log('='.repeat(80).blue.bold);
}

async function startJob(employee, activityId) {
    const payload = {
      site_id: 'IDCBT',
      employer_id: 'DSV',
      employee_id: formatEmployeeId(employee.shortId),
      activity_id: activityId,
      status: 'Open',
      status_message: 'Created by job clocking automation',
      start_time: moment().format('M/D/YYYY HH:mm:ss'),
      ClockingReference: '',
      DeviceName: DEVICE_IP
    };
  
    try {
      const response = await axios.post(`${API_BASE_URL}/AddJobClocking`, payload, { headers });
      const activityName = activityId === employee.adminSapActivityId ? 'Admin SAP' : 'Break';
      
      employeeStates[employee.shortId] = {
        currentJobClockingId: response.data.job_clocking_id, // Adjust based on actual API response
        currentActivity: activityName
      };
      
      console.log(`Started ${activityName} for ${employee.name}`);
      return response.data;
    } catch (error) {
      console.error(`Error starting job for ${employee.name}:`, error.message);
    }
  }
  
  // Stop job function
  async function stopJob(jobClockingId, employeeName, employeeShortId) {
    const payload = {
      end_time: moment().format('M/D/YYYY HH:mm:ss'),
      job_clocking_id: jobClockingId
    };
  
    try {
      const response = await axios.post(`${API_BASE_URL}/UpdateobClocking`, payload, { headers });
      
      employeeStates[employeeShortId] = {
        currentJobClockingId: null,
        currentActivity: 'None'
      };
      
      console.log(`Stopped job for ${employeeName}`);
      return response.data;
    } catch (error) {
      console.error(`Error stopping job for ${employeeName}:`, error.message);
    }
  }
  
  // Schedule jobs for each employee
  function scheduleEmployeeJobs(employee) {
    if (!employee.enabled) return;
  
    // Initialize employee state
    employeeStates[employee.shortId] = {
      currentJobClockingId: null,
      currentActivity: 'None'
    };
  
    // Schedule start work
    schedule.scheduleJob(`start-${employee.shortId}`, `0 ${employee.schedule.startWorkTime.replace(':', ' ')} * * *`, async () => {
      await startJob(employee, employee.adminSapActivityId);
    });
  
    // Schedule lunch break start
    schedule.scheduleJob(`break-start-${employee.shortId}`, `0 ${employee.schedule.lunchBreakStart.replace(':', ' ')} * * *`, async () => {
      if (employeeStates[employee.shortId].currentJobClockingId) {
        await stopJob(employeeStates[employee.shortId].currentJobClockingId, employee.name, employee.shortId);
      }
      await startJob(employee, employee.breakActivityId);
    });
  
    // Schedule lunch break end
    schedule.scheduleJob(`break-end-${employee.shortId}`, `0 ${employee.schedule.lunchBreakEnd.replace(':', ' ')} * * *`, async () => {
      if (employeeStates[employee.shortId].currentJobClockingId) {
        await stopJob(employeeStates[employee.shortId].currentJobClockingId, employee.name, employee.shortId);
      }
      await startJob(employee, employee.adminSapActivityId);
    });
  
    // Schedule end work
    schedule.scheduleJob(`end-${employee.shortId}`, `0 ${employee.schedule.endWorkTime.replace(':', ' ')} * * *`, async () => {
      if (employeeStates[employee.shortId].currentJobClockingId) {
        await stopJob(employeeStates[employee.shortId].currentJobClockingId, employee.name, employee.shortId);
      }
    });
  }

// Initialize scheduling for all employees
function initialize() {
  console.log('Initializing job clocking automation...'.green.bold);
  employees.forEach(employee => {
    if (employee.enabled) {
      scheduleEmployeeJobs(employee);
    }
  });
  
  // Update console every second
  setInterval(updateConsole, 1000);
}

// Start the automation
initialize();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down automation...'.yellow);
  process.exit(0);
});