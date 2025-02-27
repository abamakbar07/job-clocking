// Job Clocking API Integration for Multiple Users

const fs = require('fs');
const path = require('path');
const API_BASE_URL = 'http://rpt.apac.dsv.com:81/api/JobClocking';
const SITE_ID = 'IDCBT';
const DEVICE_IP = '10.132.96.240';
const DEVICE_NAME = 'w-pc2807kv.dsv.com';

// Path to the employees JSON file
const EMPLOYEES_FILE_PATH = path.join(__dirname, 'employees.json');

// Function to load employees from JSON file
function loadEmployees() {
  try {
    if (fs.existsSync(EMPLOYEES_FILE_PATH)) {
      const data = fs.readFileSync(EMPLOYEES_FILE_PATH, 'utf8');
      return JSON.parse(data);
    } else {
      // Create a default file if it doesn't exist
      const defaultEmployees = [
        {
          "shortId": "4049",
          "name": "Muhamad Afriansyah",
          "adminSapActivityId": 9603,
          "breakActivityId": 9047,
          "enabled": true,
          "schedule": {
            "startWorkTime": "09:00",
            "lunchBreakStart": "12:00",
            "lunchBreakEnd": "13:00",
            "endWorkTime": "17:00"
          }
        }
        // You can add more employees here
      ];
      
      fs.writeFileSync(EMPLOYEES_FILE_PATH, JSON.stringify(defaultEmployees, null, 2));
      return defaultEmployees;
    }
  } catch (error) {
    console.error('Error loading employees file:', error);
    return [];
  }
}

// Function to save the updated employee information back to the file
function saveEmployees(employees) {
  try {
    fs.writeFileSync(EMPLOYEES_FILE_PATH, JSON.stringify(employees, null, 2));
  } catch (error) {
    console.error('Error saving employees file:', error);
  }
}

// Function to add a new employee to the JSON file
function addEmployee(shortId, name, adminSapActivityId = 9603, breakActivityId = 9047, enabled = true) {
  const employees = loadEmployees();
  
  // Check if employee already exists
  const existingIndex = employees.findIndex(emp => emp.shortId === shortId);
  
  const employee = {
    shortId,
    name,
    adminSapActivityId,
    breakActivityId,
    enabled,
    schedule: {
      startWorkTime: "09:00",
      lunchBreakStart: "12:00",
      lunchBreakEnd: "13:00",
      endWorkTime: "17:00"
    },
    lastJobClockingId: null,
    lastActivity: null,
    lastUpdateTime: null
  };
  
  if (existingIndex >= 0) {
    // Update existing employee
    employees[existingIndex] = {...employees[existingIndex], ...employee};
  } else {
    // Add new employee
    employees.push(employee);
  }
  
  saveEmployees(employees);
  return employee;
}

// Function to get employee information from the API
async function getEmployeeInfo(shortId) {
  try {
    const response = await fetch(`${API_BASE_URL}/GetEmployee/${shortId}/${SITE_ID}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'Referer': 'http://jobclocking.apac.dsv.com/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get employee info: ${response.status}`);
    }
    
    const employeeInfo = await response.json();
    
    // Update the local JSON with the latest job_clocking_id
    updateEmployeeStatus(shortId, employeeInfo);
    
    return employeeInfo;
  } catch (error) {
    console.error(`Error fetching info for employee ${shortId}:`, error);
    throw error;
  }
}

// Update the local employee status in our JSON file
function updateEmployeeStatus(shortId, apiEmployeeInfo) {
  const employees = loadEmployees();
  const employeeIndex = employees.findIndex(emp => emp.shortId === shortId);
  
  if (employeeIndex >= 0) {
    employees[employeeIndex].lastJobClockingId = apiEmployeeInfo.job_clocking_id;
    employees[employeeIndex].lastActivity = apiEmployeeInfo.activity_name;
    employees[employeeIndex].lastUpdateTime = new Date().toISOString();
    saveEmployees(employees);
  }
}

// Function to start a job clocking session for a specific employee
async function startJobClocking(shortId, activityId, statusMessage = 'Created by automated job clocking') {
  try {
    // First get the employee info to ensure we have the correct employee_id
    const employeeInfo = await getEmployeeInfo(shortId);
    
    const currentTime = new Date().toLocaleString('en-US');
    
    const payload = {
      site_id: SITE_ID,
      employer_id: 'DSV',
      employee_id: employeeInfo.employee_id,
      activity_id: activityId,
      status: 'Open',
      status_message: statusMessage,
      start_time: currentTime,
      ClockingReference: '',
      DeviceName: DEVICE_IP
    };
    
    const response = await fetch(`${API_BASE_URL}/AddJobClocking`, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'Referer': 'http://jobclocking.apac.dsv.com/'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to start job: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Get updated employee info after starting job
    await getEmployeeInfo(shortId);
    
    console.log(`Job started successfully for employee ${shortId}:`, result);
    return result;
  } catch (error) {
    console.error(`Error starting job for employee ${shortId}:`, error);
    throw error;
  }
}

// Function to start a break for a specific employee
async function startBreak(shortId) {
  const employees = loadEmployees();
  const employee = employees.find(emp => emp.shortId === shortId);
  
  if (!employee) {
    throw new Error(`Employee with ID ${shortId} not found`);
  }
  
  return startJobClocking(shortId, employee.breakActivityId, 'Started break via automated job clocking');
}

// Function to start Admin SAP activity for a specific employee
async function startAdminSAP(shortId) {
  const employees = loadEmployees();
  const employee = employees.find(emp => emp.shortId === shortId);
  
  if (!employee) {
    throw new Error(`Employee with ID ${shortId} not found`);
  }
  
  return startJobClocking(shortId, employee.adminSapActivityId, 'Started Admin SAP via automated job clocking');
}

// Function to stop the current job for a specific employee
async function stopCurrentJob(shortId) {
  try {
    // First get the current employee info to get the job_clocking_id
    const employeeInfo = await getEmployeeInfo(shortId);
    
    if (!employeeInfo.job_clocking_id) {
      console.log(`No active job to stop for employee ${shortId}`);
      return null;
    }
    
    const currentTime = new Date().toLocaleString('en-US');
    
    const payload = {
      end_time: currentTime,
      job_clocking_id: employeeInfo.job_clocking_id
    };
    
    const response = await fetch(`${API_BASE_URL}/UpdateJobClocking`, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'Referer': 'http://jobclocking.apac.dsv.com/'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to stop job: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Update local employee status
    const employees = loadEmployees();
    const employeeIndex = employees.findIndex(emp => emp.shortId === shortId);
    if (employeeIndex >= 0) {
      employees[employeeIndex].lastJobClockingId = null;
      employees[employeeIndex].lastActivity = "None";
      employees[employeeIndex].lastUpdateTime = new Date().toISOString();
      saveEmployees(employees);
    }
    
    console.log(`Job stopped successfully for employee ${shortId}:`, result);
    return result;
  } catch (error) {
    console.error(`Error stopping job for employee ${shortId}:`, error);
    throw error;
  }
}

// Function to process all enabled employees
async function processAllEmployees(action) {
  const employees = loadEmployees();
  const enabledEmployees = employees.filter(emp => emp.enabled);
  
  console.log(`Processing ${action} for ${enabledEmployees.length} enabled employees`);
  
  for (const employee of enabledEmployees) {
    try {
      console.log(`Performing ${action} for ${employee.name} (${employee.shortId})`);
      
      switch (action) {
        case 'startWork':
          await stopCurrentJob(employee.shortId); // Ensure no active session
          await startAdminSAP(employee.shortId);
          break;
        case 'startBreak':
          await stopCurrentJob(employee.shortId);
          await startBreak(employee.shortId);
          break;
        case 'endBreak':
          await stopCurrentJob(employee.shortId);
          await startAdminSAP(employee.shortId);
          break;
        case 'endWork':
          await stopCurrentJob(employee.shortId);
          break;
        default:
          console.log(`Unknown action: ${action}`);
      }
      
      console.log(`Successfully processed ${action} for ${employee.name}`);
    } catch (error) {
      console.error(`Error processing ${action} for ${employee.name}:`, error);
    }
  }
}

// Command line interface for manual control
function handleCommandLine() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log(`
Available commands:
  add-employee <shortId> <name> [adminActivityId] [breakActivityId]  - Add a new employee
  enable-employee <shortId>                                         - Enable an employee
  disable-employee <shortId>                                        - Disable an employee
  list-employees                                                    - List all employees
  start-work [shortId]                                              - Start work for one or all employees
  start-break [shortId]                                             - Start break for one or all employees
  end-break [shortId]                                               - End break for one or all employees
  end-work [shortId]                                                - End work for one or all employees
  status [shortId]                                                  - Get status for one or all employees
    `);
    return;
  }
  
  const handleSingleOrAll = async (action, shortId) => {
    if (shortId) {
      const employees = loadEmployees();
      const employee = employees.find(emp => emp.shortId === shortId);
      if (!employee) {
        console.log(`Employee with ID ${shortId} not found`);
        return;
      }
      
      if (!employee.enabled) {
        console.log(`Employee ${employee.name} (${shortId}) is disabled. Enable first.`);
        return;
      }
      
      switch (action) {
        case 'startWork':
          await stopCurrentJob(shortId);
          await startAdminSAP(shortId);
          break;
        case 'startBreak':
          await stopCurrentJob(shortId);
          await startBreak(shortId);
          break;
        case 'endBreak':
          await stopCurrentJob(shortId);
          await startAdminSAP(shortId);
          break;
        case 'endWork':
          await stopCurrentJob(shortId);
          break;
        case 'status':
          const info = await getEmployeeInfo(shortId);
          console.log(`Status for ${info.name} (${shortId}):`);
          console.log(`  Current activity: ${info.activity_name || 'None'}`);
          console.log(`  Job clocking ID: ${info.job_clocking_id || 'None'}`);
          break;
      }
    } else {
      if (action === 'status') {
        const employees = loadEmployees();
        for (const emp of employees.filter(e => e.enabled)) {
          try {
            const info = await getEmployeeInfo(emp.shortId);
            console.log(`Status for ${info.name} (${emp.shortId}):`);
            console.log(`  Current activity: ${info.activity_name || 'None'}`);
            console.log(`  Job clocking ID: ${info.job_clocking_id || 'None'}`);
            console.log('---');
          } catch (error) {
            console.error(`Could not get status for ${emp.shortId}:`, error.message);
          }
        }
      } else {
        await processAllEmployees(action);
      }
    }
  };
  
  (async () => {
    try {
      switch (command) {
        case 'add-employee':
          const shortId = args[1];
          const name = args[2];
          const adminActivityId = args[3] ? parseInt(args[3]) : 9603;
          const breakActivityId = args[4] ? parseInt(args[4]) : 9047;
          
          if (!shortId || !name) {
            console.log('Usage: add-employee <shortId> <name> [adminActivityId] [breakActivityId]');
            return;
          }
          
          const employee = addEmployee(shortId, name, adminActivityId, breakActivityId);
          console.log(`Employee added/updated: ${employee.name} (${employee.shortId})`);
          break;
          
        case 'enable-employee':
          const enableId = args[1];
          if (!enableId) {
            console.log('Usage: enable-employee <shortId>');
            return;
          }
          
          const enableEmployees = loadEmployees();
          const enableIndex = enableEmployees.findIndex(emp => emp.shortId === enableId);
          
          if (enableIndex >= 0) {
            enableEmployees[enableIndex].enabled = true;
            saveEmployees(enableEmployees);
            console.log(`Employee ${enableEmployees[enableIndex].name} (${enableId}) enabled`);
          } else {
            console.log(`Employee with ID ${enableId} not found`);
          }
          break;
          
        case 'disable-employee':
          const disableId = args[1];
          if (!disableId) {
            console.log('Usage: disable-employee <shortId>');
            return;
          }
          
          const disableEmployees = loadEmployees();
          const disableIndex = disableEmployees.findIndex(emp => emp.shortId === disableId);
          
          if (disableIndex >= 0) {
            disableEmployees[disableIndex].enabled = false;
            saveEmployees(disableEmployees);
            console.log(`Employee ${disableEmployees[disableIndex].name} (${disableId}) disabled`);
          } else {
            console.log(`Employee with ID ${disableId} not found`);
          }
          break;
          
        case 'list-employees':
          const employees = loadEmployees();
          console.log('=== Employee List ===');
          for (const emp of employees) {
            console.log(`${emp.name} (ID: ${emp.shortId})`);
            console.log(`  Status: ${emp.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`  Admin SAP Activity ID: ${emp.adminSapActivityId}`);
            console.log(`  Break Activity ID: ${emp.breakActivityId}`);
            console.log(`  Last Activity: ${emp.lastActivity || 'None'}`);
            console.log(`  Last Update: ${emp.lastUpdateTime || 'Never'}`);
            console.log('---');
          }
          break;
          
        case 'start-work':
          await handleSingleOrAll('startWork', args[1]);
          break;
          
        case 'start-break':
          await handleSingleOrAll('startBreak', args[1]);
          break;
          
        case 'end-break':
          await handleSingleOrAll('endBreak', args[1]);
          break;
          
        case 'end-work':
          await handleSingleOrAll('endWork', args[1]);
          break;
          
        case 'status':
          await handleSingleOrAll('status', args[1]);
          break;
          
        default:
          console.log(`Unknown command: ${command}`);
          break;
      }
    } catch (error) {
      console.error('Error executing command:', error);
    }
  })();
}

// For scheduled automation using node-schedule
function setupScheduledJobs() {
  const schedule = require('node-schedule');
  
  // Process all employees for each scheduled event
  
  // Schedule job start - 9 AM weekdays
  schedule.scheduleJob('0 9 * * 1-5', async function() {
    console.log('Running scheduled job: Start workday');
    await processAllEmployees('startWork');
  });

  // Schedule lunch break - 12 PM weekdays
  schedule.scheduleJob('0 12 * * 1-5', async function() {
    console.log('Running scheduled job: Start lunch break');
    await processAllEmployees('startBreak');
  });

  // Schedule return from lunch - 1 PM weekdays
  schedule.scheduleJob('0 13 * * 1-5', async function() {
    console.log('Running scheduled job: End lunch break');
    await processAllEmployees('endBreak');
  });

  // Schedule end of day - 5 PM weekdays
  schedule.scheduleJob('0 17 * * 1-5', async function() {
    console.log('Running scheduled job: End workday');
    await processAllEmployees('endWork');
  });
  
  console.log('Scheduled jobs set up. Waiting for scheduled times...');
}

// Main execution
if (require.main === module) {
  // This script was run directly
  
  // If no arguments, show help
  if (process.argv.length <= 2) {
    console.log(`
Job Clocking Automation
=======================

Run with:
  node script.js <command> [args]
  
To see available commands:
  node script.js
  
To set up scheduled automation (requires node-schedule):
  node script.js schedule
    `);
    
    process.exit(0);
  }
  
  // Check if we should run in schedule mode
  if (process.argv[2] === 'schedule') {
    try {
      const schedule = require('node-schedule');
      setupScheduledJobs();
    } catch (error) {
      console.error('Error setting up scheduled jobs. Make sure node-schedule is installed:');
      console.error('npm install node-schedule');
      process.exit(1);
    }
  } else {
    // Run in command line mode
    handleCommandLine();
  }
}

// Export functions for use in other scripts
module.exports = {
  loadEmployees,
  addEmployee,
  getEmployeeInfo,
  startJobClocking,
  startBreak,
  startAdminSAP,
  stopCurrentJob,
  processAllEmployees
};