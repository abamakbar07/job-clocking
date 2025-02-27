const API_CONFIG = {
  BASE_URL: 'http://rpt.apac.dsv.com:81/api/JobClocking',
  DEVICE_IP: '10.132.96.240',
  HEADERS: {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'application/json',
    'Referer': 'http://jobclocking.apac.dsv.com/',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
};

module.exports = {
  API_CONFIG
}; 