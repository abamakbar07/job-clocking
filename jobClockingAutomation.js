const schedule = require('node-schedule');
const axios = require('axios');
const moment = require('moment');
const employees = require('./employees.json');

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

// Helper function to format employee ID
const formatEmployeeId = (shortId) => `21.${shortId}/ID-JKT`;

// Helper function to calculate time until next event
function getTimeUntil(timeStr) {
  const [hours, minutes] = timeStr.split(':');
  const nextTime = moment().startOf('day').add(hours, 'hours').add(minutes, 'minutes');
  if (nextTime.isBefore(moment())) {
    nextTime.add(1, 'day');
  }
  return moment.duration(nextTime.diff(moment()));
}

// Helper function to format duration
function formatDuration(duration) {
  return `${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`;
}

// Clear console and print status
function updateConsole() {
  console.clear();
  console.log(`Current Time: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n`);
  
  employees.forEach(employee => {
    if (employee.enabled) {
      console.log(`\n=== ${employee.name} (ID: ${employee.shortId}) ===`);
      console.log(`Current Job Clocking ID: ${employeeStates[employee.shortId]?.currentJobClockingId || 'None'}`);
      console.log(`Current Activity: ${employeeStates[employee.shortId]?.currentActivity || 'None'}`);
      
      const schedule = employee.schedule;
      const now = moment();
      
      // Show countdown for each scheduled event
      const events = [
        { name: 'Start Work', time: schedule.startWorkTime },
        { name: 'Lunch Break', time: schedule.lunchBreakStart },
        { name: 'End Break', time: schedule.lunchBreakEnd },
        { name: 'End Work', time: schedule.endWorkTime }
      ];

      events.forEach(event => {
        const timeUntil = getTimeUntil(event.time);
        console.log(`${event.name} (${event.time}): ${formatDuration(timeUntil)}`);
      });
    }
  });
}

// Start job function
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
  console.log('Initializing job clocking automation...');
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
  console.log('\nShutting down automation...');
  process.exit(0);
});