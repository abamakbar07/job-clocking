const axios = require('axios');
const moment = require('moment');
const { API_CONFIG } = require('../config/constants');

class JobClockingAPI {
  static async startJob(employeeId, activityId) {
    const payload = {
      site_id: 'IDCBT',
      employer_id: 'DSV',
      employee_id: employeeId,
      activity_id: activityId,
      status: 'Open',
      status_message: 'Created by job clocking automation',
      start_time: moment().format('M/D/YYYY HH:mm:ss'),
      ClockingReference: '',
      DeviceName: API_CONFIG.DEVICE_IP
    };

    try {
      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/AddJobClocking`, 
        payload, 
        { headers: API_CONFIG.HEADERS }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start job: ${error.message}`);
    }
  }

  static async stopJob(jobClockingId) {
    const payload = {
      end_time: moment().format('M/D/YYYY HH:mm:ss'),
      job_clocking_id: jobClockingId
    };

    try {
      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/UpdateobClocking`, 
        payload, 
        { headers: API_CONFIG.HEADERS }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to stop job: ${error.message}`);
    }
  }
}

module.exports = JobClockingAPI; 