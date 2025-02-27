const readline = require('readline');

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function promptUserId() {
  const rl = createInterface();
  
  return new Promise((resolve) => {
    rl.question('Please enter employee ID (e.g., 4049): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

module.exports = {
  promptUserId
}; 