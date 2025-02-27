const schedule = require('node-schedule');
const axios = require('axios');
const moment = require('moment');
const JobClockingAPI = require('./services/api');
const { updateConsole } = require('./utils/consoleUtils');
const { API_CONFIG } = require('./config/constants');

// Global state
const employeeStates = {
  "4049": {
    shortId: "4049",
    name: "Muhamad Afriansyah",
    adminSapActivityId: 9603,
    breakActivityId: 9047,
    enabled: true,
    schedule: {
      startWorkTime: "10:00",
      lunchBreakStart: "12:00",
      lunchBreakEnd: "13:00",
      endWorkTime: "18:00"
    },
    currentJobClockingId: null,
    currentActivity: null,
    lastUpdateTime: null
  }
};

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

async function getUserStatus(employeeId) {
  try {
    const response = await axios.get(`${API_CONFIG.BASE_URL}/GetUserStatus`, {
      headers: API_CONFIG.HEADERS,
      params: {
        employee_id: employeeId
      }
    });

    const data = response.data;
    return {
      currentJobClockingId: data.job_clocking_id || 0,
      currentActivity: data.activity_name || 'None',
      lastUpdateTime: moment().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching status for employee ${employeeId}:`, error.message);
    return null;
  }
}

async function updateAllEmployeesStatus() {
  try {
    console.log('\nUpdating employee statuses...');
    let hasUpdates = false;

    for (const employeeId in employeeStates) {
      const employee = employeeStates[employeeId];
      if (employee.enabled) {
        const status = await getUserStatus(employee.shortId);
        if (status) {
          hasUpdates = true;
          employeeStates[employeeId] = {
            ...employee,
            currentJobClockingId: status.currentJobClockingId,
            currentActivity: status.currentActivity,
            lastUpdateTime: status.lastUpdateTime
          };
        }
      }
    }

    if (hasUpdates) {
      console.log('Employee statuses updated successfully');
    }
  } catch (error) {
    console.error('Error updating employee statuses:', error.message);
  }
}

function initialize() {
  console.log('Initializing job clocking automation...');
  
  // Initial status update
  updateAllEmployeesStatus();

  // Schedule status updates every 5 minutes
  schedule.scheduleJob('*/5 * * * *', updateAllEmployeesStatus);
  
  // Update console display
  setInterval(() => updateConsole(employeeStates), 1000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down automation...');
  process.exit(0);
});

// Start the application
initialize(); 