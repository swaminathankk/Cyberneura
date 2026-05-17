require('dotenv').config();
const { classifyUrl, checkAiServiceHealth } = require('./src/services/aiStub.service');

async function verify() {
  console.log('--- Verifying Node.js to AI Microservice Communication ---');
  
  // 1. Health check
  console.log('\nChecking health...');
  const health = await checkAiServiceHealth();
  console.log('Health Response:', health);
  
  if (!health.healthy) {
    console.error('AI Service is not healthy or unreachable. Exiting.');
    return;
  }

  // 2. Classify a known benign URL
  const benignUrl = 'https://google.com';
  console.log(`\nClassifying Benign URL: ${benignUrl}`);
  const benignScore = await classifyUrl(benignUrl, {
    entropy: 2.1,
    urlLength: 18,
    flagCount: 0
  });
  console.log(`Score for ${benignUrl}:`, benignScore);

  // 3. Classify a known malicious-looking URL
  const maliciousUrl = 'http://secure-update-paypal.com-login-verify-account.info/login.php';
  console.log(`\nClassifying Malicious URL: ${maliciousUrl}`);
  const maliciousScore = await classifyUrl(maliciousUrl, {
    entropy: 4.8,
    urlLength: 72,
    flagCount: 3
  });
  console.log(`Score for ${maliciousUrl}:`, maliciousScore);

  console.log('\n✅ End-to-end communication verified successfully!');
}

verify();
