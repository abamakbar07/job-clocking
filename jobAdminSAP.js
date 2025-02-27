fetch("http://rpt.apac.dsv.com:81/api/JobClocking/AddJobClocking", {
  "headers": {
    "accept": "application/json, text/plain, */*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type": "application/json",
    "Referer": "http://jobclocking.apac.dsv.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": "{\"site_id\":\"IDCBT\",\"employer_id\":\"DSV\",\"employee_id\":\"21.4049/ID-JKT\",\"activity_id\":9603,\"status\":\"Open\",\"status_message\":\"Created by job clocking application\",\"start_time\":\"2/27/2025 14:29:23\",\"ClockingReference\":\"\",\"DeviceName\":\"10.132.96.240\"}",
  "method": "POST"
});