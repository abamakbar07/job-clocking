const schedule = require('node-schedule');
const JobClockingAPI = require('./services/api');
const { updateConsole } = require('./utils/consoleUtils');
const employees = require('../employees.json');

// Global state
const employeeStates = {};

async function handleJobTransition(employee, action, activityId = null) {
  try {
    const currentState = employeeStates[employee.shortId];
    
    if (action === 'stop' && currentState?.currentJobClockingId) {
      await JobClockingAPI.stopJob(currentState.currentJobClockingId);
      employeeStates[employee.shortId] = { currentJobClockingId: null, currentActivity: 'None' };
    }
    
    if (action === 'start' && activityId) {
      const result = await JobClockingAPI.startJob(employee.shortId, activityId);
      employeeStates[employee.shortId] = {
        currentJobClockingId: result.job_clocking_id,
        currentActivity: activityId === employee.adminSapActivityId ? 'Admin SAP' : 'Break'
      };
    }
  } catch (error) {
    console.error(`Error in job transition for ${employee.name}:`, error.message);
  }
}

// ... rest of the scheduling logic

function initialize() {
  console.log('Initializing job clocking automation...'.green.bold);
  employees.forEach(employee => {
    if (employee.enabled) {
      scheduleEmployeeJobs(employee);
    }
  });
  
  setInterval(updateConsole, 1000);
}

initialize();

process.on('SIGINT', () => {
  console.log('\nShutting down automation...'.yellow);
  process.exit(0);
}); 